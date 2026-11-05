import express from 'express';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, sep } from 'node:path';
import apiRouter from './api/index.js';
import { requireAdminPage } from './api/middleware.js';
import { startMcpServer } from './services/mcp/mcp.js';
import { attachWebSocketServer } from './services/webSocketService.js';
import { createJsonChunkMiddleware } from './services/jsonChunkService.js';
import { expireStaleDialogueSessions } from './containers/dialogueContainer.js';
import { startGameClock } from './services/gameClockService.js';
import { startLocationWeatherSweep } from './services/locationWeatherService.js';
import { startAmbienceSystem } from './services/locationAmbienceService.js';
import { startPartyPresence } from './services/partyPresenceService.js';
import { aiApiKeyContextMiddleware } from './services/ai/aiRequestContext.js';
import { BYTES_PER_MB, CONTENT_TYPES, DEFAULT_CONTENT_TYPE, DIALOGUE_EXPIRY_SWEEP_INTERVAL_MS, HTTP_STATUS, MAX_JSON_BODY_BYTES, SERVER_DEFAULTS } from './configs/constants.js';

const publicDirectory = join(process.cwd(), SERVER_DEFAULTS.PUBLIC_DIRECTORY);

function safePublicPath(pathname) {
  const requested = pathname === '/' || pathname === '/index.html' ? SERVER_DEFAULTS.LANDING_PAGE : pathname;
  const resolved = normalize(join(publicDirectory, requested));
  const relativePath = relative(publicDirectory, resolved);
  return relativePath && relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !relativePath.startsWith(sep) ? resolved : null;
}

export function createWebApp() {
  const app = express();
  app.use(express.json({ limit: MAX_JSON_BODY_BYTES }));
  app.use(createJsonChunkMiddleware());
  app.use('/api', aiApiKeyContextMiddleware, apiRouter);

  app.get('/admin.html', requireAdminPage);
  app.use(async (request, response) => {
    const filePath = safePublicPath(request.path);
    if (!filePath) return response.status(HTTP_STATUS.FORBIDDEN).send('Forbidden');
    try {
      const file = await readFile(filePath);
      return response.type(CONTENT_TYPES[extname(filePath)] || DEFAULT_CONTENT_TYPE).send(file);
    } catch {
      return response.status(HTTP_STATUS.NOT_FOUND).send('Page not found');
    }
  });
  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);
    if (error?.type === 'entity.too.large' || error?.status === HTTP_STATUS.PAYLOAD_TOO_LARGE) {
      return response.status(HTTP_STATUS.PAYLOAD_TOO_LARGE).json({ error: `The request body is larger than the ${MAX_JSON_BODY_BYTES / BYTES_PER_MB} MB limit.` });
    }
    if (error instanceof SyntaxError && error.status === HTTP_STATUS.BAD_REQUEST && error.body !== undefined) {
      return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'The request body must be valid JSON.' });
    }
    return response.status(error?.status || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'The server could not process the request.' });
  });
  return app;
}

export function startServer() {
  const port = Number(process.env.PORT || SERVER_DEFAULTS.PORT);
  const webServer = createWebApp().listen(port, () => console.error(`Stervian web app is running at http://localhost:${port}`));
  attachWebSocketServer(webServer);
  startGameClock();
  startLocationWeatherSweep();
  startAmbienceSystem();
  startPartyPresence();
  startMcpServer(Number(process.env.MCP_PORT || SERVER_DEFAULTS.MCP_PORT));
  const sweepDialogueSessions = () => expireStaleDialogueSessions().catch((error) => console.warn('[startServer] Dialogue session sweep failed:', error.message));
  sweepDialogueSessions();
  setInterval(sweepDialogueSessions, DIALOGUE_EXPIRY_SWEEP_INTERVAL_MS).unref();
  return webServer;
}
