import { BYTES_PER_MB, MAX_IMAGE_BYTES } from '../../configs/constants.js';

function hexPrefix(buffer, length) {
  return Buffer.from(buffer.subarray(0, length)).toString('hex').toLowerCase();
}

function imageMimeType(buffer) {
  const prefix = hexPrefix(buffer, 12);
  if (prefix.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (prefix.startsWith('ffd8ff')) return 'image/jpeg';
  if (prefix.startsWith('47494638')) return 'image/gif';
  if (prefix.startsWith('52494646') && prefix.slice(16, 24) === '57454250') return 'image/webp';
  return null;
}

function isCompleteImage(buffer, mime) {
  if (mime === 'image/png') {
    if (buffer.length < 33 || hexPrefix(buffer, 8) !== '89504e470d0a1a0a' || buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') return false;
    let offset = 8;
    let hasImageData = false;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const end = offset + 12 + length;
      if (end > buffer.length) return false;
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') hasImageData = true;
      if (type === 'IEND') return length === 0 && hasImageData && end === buffer.length;
      offset = end;
    }
    return false;
  }
  if (mime === 'image/jpeg') {
    if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return false;
    let offset = 2;
    let hasFrame = false;
    let hasScan = false;
    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xff) return false;
      while (offset < buffer.length - 1 && buffer[offset] === 0xff) offset += 1;
      if (offset >= buffer.length - 1) return false;
      const marker = buffer[offset++];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
      if (marker === 0xda) {
        if (!hasFrame || offset + 2 > buffer.length - 2) return false;
        const scanLength = buffer.readUInt16BE(offset);
        if (scanLength < 6 || offset + scanLength > buffer.length - 2) return false;
        const components = buffer[offset + 2];
        if (!components || scanLength !== 6 + components * 2) return false;
        offset += scanLength;
        const entropyStart = offset;
        let entropyBytes = 0;
        while (offset < buffer.length - 1) {
          if (buffer[offset] !== 0xff) { entropyBytes += 1; offset += 1; continue; }
          const markerOffset = offset;
          let next = offset + 1;
          while (next < buffer.length && buffer[next] === 0xff) next += 1;
          if (next >= buffer.length) return false;
          const entropyMarker = buffer[next];
          if (entropyMarker === 0x00 || (entropyMarker >= 0xd0 && entropyMarker <= 0xd7)) {
            entropyBytes += 1;
            offset = next + 1;
            continue;
          }
          if (entropyMarker === 0xd9) {
            if (next !== buffer.length - 1 || entropyBytes === 0) return false;
            hasScan = true;
            offset = next + 1;
            break;
          }
          if (entropyBytes === 0) return false;
          hasScan = true;
          offset = markerOffset;
          break;
        }
        if (!hasScan) return false;
        if (offset === buffer.length) return hasFrame;
        continue;
      }
      if (marker === 0xd9) return hasFrame && hasScan && offset === buffer.length - 1;
      if (offset + 2 > buffer.length - 2) return false;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length - 2) return false;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (length < 8) return false;
        const components = buffer[offset + 7];
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        if (!components || !width || !height || length !== 8 + components * 3) return false;
        hasFrame = true;
      }
      offset += length;
    }
    return hasFrame && hasScan;
  }
  if (mime === 'image/gif') return buffer.length >= 15 && (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') && buffer[buffer.length - 1] === 0x3b && buffer.indexOf(0x2c, 13) !== -1;
  if (mime === 'image/webp') {
    if (buffer.length < 20 || buffer.readUInt32LE(4) + 8 !== buffer.length || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return false;
    let offset = 12;
    let hasChunk = false;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32LE(offset + 4);
      const end = offset + 8 + length + (length % 2);
      if (end > buffer.length) return false;
      const type = buffer.toString('ascii', offset, offset + 4);
      if (['VP8 ', 'VP8L', 'VP8X'].includes(type)) hasChunk = true;
      offset = end;
    }
    return hasChunk && offset === buffer.length;
  }
  return false;
}

export function imageDataToBuffer(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('The avatar image must be base64 data.');
  const match = value.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  const encoded = match ? match[2] : value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error('The avatar image must be valid base64 data.');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error(`The avatar image must be between 1 byte and ${MAX_IMAGE_BYTES / BYTES_PER_MB} MB.`);
  const detectedMime = imageMimeType(buffer);
  if (!detectedMime || (match && match[1].toLowerCase() !== detectedMime)) throw new Error('The avatar image format is not supported.');
  if (!isCompleteImage(buffer, detectedMime)) throw new Error('The avatar image is incomplete.');
  return buffer;
}

export function imageDataToUrl(value) {
  if (!value) return null;
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const mime = imageMimeType(buffer);
  return mime && isCompleteImage(buffer, mime) ? `data:${mime};base64,${buffer.toString('base64')}` : null;
}
