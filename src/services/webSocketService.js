import { WebSocketServer, WebSocket } from 'ws';
import { getSession } from './sessionService.js';
import { markPlayerOnline } from './onlineResourceService.js';
import {
  WEBSOCKET_CLOSE_GOING_AWAY,
  WEBSOCKET_ERROR_CODES,
  WEBSOCKET_EVENTS,
  WEBSOCKET_MAX_PAYLOAD_BYTES,
  WEBSOCKET_MAX_REQUEST_ID_LENGTH,
  WEBSOCKET_PATH,
  WEBSOCKET_PROTOCOL_VERSION,
  WEBSOCKET_STORY_CHANNEL,
} from '../configs/constants.js';

const socketsByUserId = new Map();
const presenceListeners = new Set();
let storyBroadcaster;

export function onUserPresenceChange(listener) {
  presenceListeners.add(listener);
  return () => presenceListeners.delete(listener);
}

function emitPresence(userId, isOnline) {
  for (const listener of presenceListeners) {
    try { listener(userId, isOnline); } catch (error) { console.warn('[webSocket] Presence listener failed:', error.message); }
  }
}

export function getStoryBroadcaster() { return storyBroadcaster; }

export function broadcastToUsers(userIds, type, data) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  let delivered = 0;
  for (const uid of ids) {
    const sockets = socketsByUserId.get(uid);
    if (!sockets) continue;
    for (const socket of sockets) {
      sendJson(socket, { type, data });
      delivered += 1;
    }
  }
  return delivered;
}

export function broadcastToAll(type, data) {
  let delivered = 0;
  for (const sockets of socketsByUserId.values()) {
    for (const socket of sockets) {
      sendJson(socket, { type, data });
      delivered += 1;
    }
  }
  return delivered;
}

function sendJson(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try { socket.send(JSON.stringify(message)); } catch { /* The close handler will clean up the socket. */ }
}

function sendError(socket, code, message, requestId) {
  sendJson(socket, { type: WEBSOCKET_EVENTS.ERROR, data: { code, message }, ...(requestId ? { requestId } : {}) });
}

function requestIdOf(message) {
  return typeof message.requestId === 'string' && message.requestId.length <= WEBSOCKET_MAX_REQUEST_ID_LENGTH ? message.requestId : undefined;
}

export function attachWebSocketServer(httpServer) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: WEBSOCKET_MAX_PAYLOAD_BYTES });

  function registerSocket(socket, userId) {
    const sockets = socketsByUserId.get(userId) || new Set();
    const wasOffline = sockets.size === 0;
    sockets.add(socket);
    socketsByUserId.set(userId, sockets);
    if (wasOffline) emitPresence(userId, true);
    socket.isStorySubscriber = false;
    const releaseOnline = markPlayerOnline(userId);
    socket.on('close', () => {
      releaseOnline();
      sockets.delete(socket);
      if (!sockets.size) {
        socketsByUserId.delete(userId);
        emitPresence(userId, false);
      }
    });
  }

  webSocketServer.on('connection', (socket, request, session) => {
    registerSocket(socket, session.user_id);
    sendJson(socket, { type: WEBSOCKET_EVENTS.CONNECTED, data: { protocolVersion: WEBSOCKET_PROTOCOL_VERSION } });
    socket.on('message', (rawMessage) => {
      const text = rawMessage.toString();
      let message;
      try { message = JSON.parse(text); } catch { sendError(socket, WEBSOCKET_ERROR_CODES.INVALID_JSON, 'Message must be valid JSON.'); return; }
      if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') {
        sendError(socket, WEBSOCKET_ERROR_CODES.INVALID_MESSAGE, 'Message type is required.', requestIdOf(message || {}));
        return;
      }
      const requestId = requestIdOf(message);
      if (message.type === WEBSOCKET_EVENTS.SUBSCRIBE) {
        if (message.channel && message.channel !== WEBSOCKET_STORY_CHANNEL) {
          sendError(socket, WEBSOCKET_ERROR_CODES.UNKNOWN_CHANNEL, 'Only the story channel is available.', requestId);
          return;
        }
        socket.isStorySubscriber = true;
        sendJson(socket, { type: WEBSOCKET_EVENTS.ACK, requestId, data: { requestType: WEBSOCKET_EVENTS.SUBSCRIBE, channel: WEBSOCKET_STORY_CHANNEL } });
        return;
      }
      if (message.type === WEBSOCKET_EVENTS.PING) {
        sendJson(socket, { type: WEBSOCKET_EVENTS.PONG, requestId, data: { serverTime: new Date().toISOString() } });
        return;
      }
      sendError(socket, WEBSOCKET_ERROR_CODES.UNKNOWN_MESSAGE, 'Unsupported WebSocket message type.', requestId);
    });
  });

  function handleUpgrade(request, socket, head) {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    if (requestUrl.pathname !== WEBSOCKET_PATH) { socket.destroy(); return; }
    let session;
    try { session = getSession(request); } catch { session = null; }
    if (!session?.user_id) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => webSocketServer.emit('connection', webSocket, request, session));
  }

  httpServer.on('upgrade', handleUpgrade);
  const api = {
    server: webSocketServer,
    close: () => {
      httpServer.off('upgrade', handleUpgrade);
      for (const sockets of socketsByUserId.values()) for (const socket of sockets) socket.close(WEBSOCKET_CLOSE_GOING_AWAY, 'Server shutting down');
      return new Promise((resolve) => webSocketServer.close(resolve));
    },
    broadcastStoryAvailable: (userId, metadata) => {
      const sockets = socketsByUserId.get(userId);
      if (!sockets) return 0;
      let delivered = 0;
      for (const socket of sockets) {
        if (!socket.isStorySubscriber) continue;
        sendJson(socket, { type: WEBSOCKET_EVENTS.STORY_AVAILABLE, data: metadata });
        delivered += 1;
      }
      return delivered;
    },
  };
  storyBroadcaster = api.broadcastStoryAvailable;
  return api;
}
