import { Buffer } from 'node:buffer';
import { getSession } from './sessionService.js';
import {
  BYTES_PER_MB,
  HTTP_STATUS,
  JSON_CHUNK_BYTES,
  JSON_CHUNK_CLEANUP_INTERVAL_MS,
  JSON_CHUNK_HEADERS,
  JSON_CHUNK_ID_PATTERN,
  JSON_CHUNK_MODES,
  JSON_CHUNK_TTL_MS,
  MAX_ACTIVE_JSON_UPLOADS,
  MAX_BUFFERED_JSON_BYTES,
  MAX_JSON_BODY_BYTES,
  NUMERIC_ID_PATTERN,
} from '../configs/constants.js';

export { JSON_CHUNK_BYTES, JSON_CHUNK_HEADERS, MAX_JSON_BODY_BYTES };

const MAX_CHUNKS = Math.ceil(MAX_JSON_BODY_BYTES / JSON_CHUNK_BYTES);

const uploads = new Map();
let bufferedBytes = 0;

function cleanupExpiredUploads(now = Date.now()) {
  for (const [key, upload] of uploads) {
    if (upload.expiresAt <= now) removeUpload(key, upload);
  }
}

function removeUpload(key, upload = uploads.get(key)) {
  if (!upload) return;
  uploads.delete(key);
  bufferedBytes = Math.max(0, bufferedBytes - upload.bytes);
}

function sendChunkError(response, status, error) {
  return response.status(status).json({ error });
}

function integerHeader(value, maximum) {
  if (typeof value !== 'string' || !NUMERIC_ID_PATTERN.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function validChunkId(value) {
  return typeof value === 'string' && JSON_CHUNK_ID_PATTERN.test(value);
}

function uploadKey(session, chunkId) {
  return `${String(session.user_id)}:${chunkId}`;
}

function validateUploadMetadata(upload, request, total) {
  return upload.method === request.method
    && upload.target === request.originalUrl
    && upload.total === total;
}

function completeUpload(upload) {
  if (upload.chunks.some((chunk) => chunk === undefined)) return null;
  return upload.chunks.join('');
}

const cleanupTimer = setInterval(cleanupExpiredUploads, JSON_CHUNK_CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

/**
 * Reassembles large JSON bodies uploaded through the client chunk protocol.
 * Chunk requests are acknowledged immediately; the matching commit request
 * continues through the normal route with the reconstructed request.body.
 */
export function createJsonChunkMiddleware() {
  return function jsonChunkMiddleware(request, response, next) {
    const headers = request.headers;
    const chunkId = headers[JSON_CHUNK_HEADERS.id];
    if (chunkId === undefined) return next();

    cleanupExpiredUploads();

    const session = getSession(request);
    if (!session) return sendChunkError(response, HTTP_STATUS.UNAUTHORIZED, 'Authentication is required.');
    if (!validChunkId(chunkId)) return sendChunkError(response, HTTP_STATUS.BAD_REQUEST, 'The JSON chunk id is invalid.');

    const mode = headers[JSON_CHUNK_HEADERS.mode];
    const index = integerHeader(headers[JSON_CHUNK_HEADERS.index], MAX_CHUNKS - 1);
    const total = integerHeader(headers[JSON_CHUNK_HEADERS.total], MAX_CHUNKS);
    if (!Object.values(JSON_CHUNK_MODES).includes(mode)) return sendChunkError(response, HTTP_STATUS.BAD_REQUEST, 'The JSON chunk mode is invalid.');
    if (total === null || total < 1) return sendChunkError(response, HTTP_STATUS.BAD_REQUEST, 'The JSON chunk count is invalid.');

    const key = uploadKey(session, chunkId);
    if (mode === JSON_CHUNK_MODES.APPEND) {
      if (index === null || index >= total) return sendChunkError(response, HTTP_STATUS.BAD_REQUEST, 'The JSON chunk index is invalid.');
      if (!request.body || Array.isArray(request.body) || typeof request.body.chunk !== 'string') {
        return sendChunkError(response, HTTP_STATUS.BAD_REQUEST, 'The JSON chunk body is invalid.');
      }

      const chunkBytes = Buffer.byteLength(request.body.chunk, 'utf8');
      if (chunkBytes > JSON_CHUNK_BYTES) return sendChunkError(response, HTTP_STATUS.PAYLOAD_TOO_LARGE, `A JSON chunk is larger than ${JSON_CHUNK_BYTES / BYTES_PER_MB} MB.`);

      let upload = uploads.get(key);
      if (!upload) {
        if (uploads.size >= MAX_ACTIVE_JSON_UPLOADS || bufferedBytes + chunkBytes > MAX_BUFFERED_JSON_BYTES) {
          return sendChunkError(response, HTTP_STATUS.TOO_MANY_REQUESTS, 'Too many large requests are being assembled. Please retry shortly.');
        }
        upload = {
          userId: String(session.user_id),
          method: request.method,
          target: request.originalUrl,
          total,
          chunks: new Array(total),
          bytes: 0,
          expiresAt: Date.now() + JSON_CHUNK_TTL_MS,
        };
        uploads.set(key, upload);
      } else if (!validateUploadMetadata(upload, request, total)) {
        return sendChunkError(response, HTTP_STATUS.CONFLICT, 'The JSON chunks do not belong to the same request.');
      }

      const existingChunk = upload.chunks[index];
      if (existingChunk !== undefined) {
        if (existingChunk !== request.body.chunk) return sendChunkError(response, HTTP_STATUS.CONFLICT, 'The JSON chunk was uploaded more than once with different data.');
      } else {
        if (upload.bytes + chunkBytes > MAX_JSON_BODY_BYTES || bufferedBytes + chunkBytes > MAX_BUFFERED_JSON_BYTES) {
          removeUpload(key, upload);
          return sendChunkError(response, HTTP_STATUS.PAYLOAD_TOO_LARGE, `The complete JSON request is larger than ${MAX_JSON_BODY_BYTES / BYTES_PER_MB} MB.`);
        }
        upload.chunks[index] = request.body.chunk;
        upload.bytes += chunkBytes;
        bufferedBytes += chunkBytes;
      }
      upload.expiresAt = Date.now() + JSON_CHUNK_TTL_MS;

      return response.status(HTTP_STATUS.ACCEPTED).json({
        chunkReceived: true,
        chunkIndex: index,
        receivedChunks: upload.chunks.filter((chunk) => chunk !== undefined).length,
        totalChunks: upload.total,
      });
    }

    if (index !== null) return sendChunkError(response, HTTP_STATUS.BAD_REQUEST, 'A commit request cannot include a chunk index.');
    const upload = uploads.get(key);
    if (!upload || !validateUploadMetadata(upload, request, total)) return sendChunkError(response, HTTP_STATUS.NOT_FOUND, 'The JSON chunk upload was not found.');
    const serialized = completeUpload(upload);
    if (serialized === null) return sendChunkError(response, HTTP_STATUS.CONFLICT, 'The JSON chunk upload is incomplete.');
    removeUpload(key, upload);

    if (Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BODY_BYTES) {
      return sendChunkError(response, HTTP_STATUS.PAYLOAD_TOO_LARGE, `The complete JSON request is larger than ${MAX_JSON_BODY_BYTES / BYTES_PER_MB} MB.`);
    }

    try {
      request.body = JSON.parse(serialized);
    } catch {
      return sendChunkError(response, HTTP_STATUS.BAD_REQUEST, 'The reconstructed request body is not valid JSON.');
    }
    return next();
  };
}

