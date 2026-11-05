import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { registerDatabaseTools } from './core/tools.js';
import { HTTP_STATUS, MCP_SERVER, SERVER_DEFAULTS } from '../../configs/constants.js';

export function createMcpServer() {
  const server = new McpServer({ name: MCP_SERVER.NAME, version: MCP_SERVER.VERSION });
  registerDatabaseTools(server);
  return server;
}

export function startMcpServer(port = Number(process.env.MCP_PORT || SERVER_DEFAULTS.MCP_PORT)) {
  const app = createMcpExpressApp({ host: SERVER_DEFAULTS.MCP_HOST });
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (MCP_SERVER.ALLOWED_ORIGINS.includes(origin)) {
      response.set('Access-Control-Allow-Origin', origin);
      response.set('Vary', 'Origin');
      response.set('Access-Control-Allow-Headers', '*');
    }
    if (request.method === 'OPTIONS') return response.sendStatus(HTTP_STATUS.NO_CONTENT);
    return next();
  });
  const mcpHandler = toNodeHandler(createMcpHandler(() => createMcpServer(), {
    legacy: 'reject',
    onerror: (error) => console.error('Stervian MCP transport error:', error),
  }));

  app.all('/mcp', (request, response) => mcpHandler(request, response, request.body));

  const server = app.listen(port, () => console.error(`Stervian MCP server is running at http://localhost:${port}/mcp`));
  return server;
}
