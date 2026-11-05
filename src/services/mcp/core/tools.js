import { z } from 'zod';
import { MCP_TABLES, MCP_TABLE_MAP, MCP_TABLE_NAMES } from './registry.js';
import { createStory, updateStory } from '../stories/stories.js';
import { McpInputError, isMcpInputError } from './mcpError.js';
import { ERROR_NAMES, MCP_DB, MCP_DB_MESSAGES, MCP_DB_OPERATOR } from '../../../configs/constants.js';

const tableSchema = z.enum(MCP_TABLE_NAMES).describe('Table name. Call list_tables for the full list.');
const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const filterSchema = z.object({
  field: z.string().min(1).describe('Column name from describe_table.'),
  op: z.enum(Object.values(MCP_DB_OPERATOR)).describe('Operator allowed for that column type (see describe_table).'),
  value: z.union([scalarSchema, z.array(z.union([z.string(), z.number()]))]).optional().describe('Value to compare. A list for "in"; true/false for "isNull". Dates as ISO strings.')
});
const fieldsSchema = z.array(z.string().min(1)).max(100).optional().describe('Only return these columns. Defaults to every readable column.');

const positiveId = z.number().int().positive();
const nullableId = positiveId.nullable().optional();
const jsonObject = z.record(z.string(), z.unknown());
const storyText = z.string().max(MCP_DB.MAX_STORY_LENGTH);
const storyFieldsShape = {
  action_from_player: storyText.optional().describe('What the player did or said this turn.'),
  conversation_session_id: z.string().max(MCP_DB.MAX_KEY_TEXT_LENGTH).nullable().optional(),
  location_id: nullableId.describe('locations.id. Omit both place fields on create to use the character\'s current place.'),
  sublocation_id: nullableId.describe('sublocations.id. Its location is used when location_id is omitted.'),
  party_turn: z.array(jsonObject).nullable().optional(),
  fate_check: jsonObject.nullable().optional(),
  skill_check: jsonObject.nullable().optional(),
  dialogue_session_id: nullableId.describe('dialogue_sessions.id owned by the same character.'),
  dialogue_message_ids: z.array(positiveId).max(MCP_DB.MAX_DIALOGUE_MESSAGE_IDS).nullable().optional().describe('dialogue_messages.id values inside dialogue_session_id.')
};

const textResult = (text, isError = false) => ({ content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) });

function tableOf(name) {
  const table = MCP_TABLE_MAP.get(name);
  if (!table) throw new McpInputError(MCP_DB_MESSAGES.UNKNOWN_TABLE);
  return table;
}

function registerTool(server, name, description, shape, handler) {
  server.registerTool(name, { description, inputSchema: z.object(shape) }, async (input) => {
    try {
      return textResult(JSON.stringify(await handler(input ?? {})));
    } catch (error) {
      if (isMcpInputError(error)) return textResult(error.message, true);
      if (error?.name === ERROR_NAMES.DATABASE_OPERATION) return textResult(error.message, true);
      console.error(`[mcp:${name}] failed:`, error);
      return textResult(`Unable to run ${name}.`, true);
    }
  });
}

export function registerDatabaseTools(server) {
  registerTool(server, 'list_tables', 'List every Stervian database table this server exposes, with keys and whether it is writable. All tables are read-only except stories.', {}, async () => ({
    tables: MCP_TABLES.map(({ table, description, keys, writable, softDelete }) => ({ table, description, keys, writable, softDelete }))
  }));

  registerTool(server, 'describe_table', 'Describe one table: readable columns, their types, enum values and the filter operators each column supports.', {
    table: tableSchema
  }, async ({ table }) => tableOf(table).describe());

  registerTool(server, 'search_records', `Search rows in any table with column filters, sorting and paging. Soft-deleted rows are skipped unless includeDeleted is true. Returns { total, limit, offset, results }. Read-only.`, {
    table: tableSchema,
    filters: z.array(filterSchema).max(MCP_DB.MAX_FILTERS).optional().describe('Column filters. Combined with "match".'),
    match: z.enum([MCP_DB.MATCH_ALL, MCP_DB.MATCH_ANY]).optional().describe('"all" (AND, default) or "any" (OR).'),
    orderBy: z.object({ field: z.string().min(1), direction: z.enum([MCP_DB.SORT_ASC, MCP_DB.SORT_DESC]).optional() }).optional().describe('Sort column. Defaults to the primary key ascending.'),
    fields: fieldsSchema,
    limit: z.number().int().min(1).max(MCP_DB.MAX_LIMIT).optional().describe(`Rows to return (default ${MCP_DB.DEFAULT_LIMIT}, max ${MCP_DB.MAX_LIMIT}).`),
    offset: z.number().int().min(0).optional().describe('Rows to skip for paging.'),
    includeDeleted: z.boolean().optional().describe('Include soft-deleted rows.')
  }, async ({ table, ...input }) => tableOf(table).search(input));

  registerTool(server, 'get_record', 'Get one row by its primary key. Composite keys need every key column (see list_tables). Read-only.', {
    table: tableSchema,
    key: z.record(z.string(), z.union([z.string(), z.number()])).describe('Primary key, e.g. { "id": 5 } or { "character_id": 3, "skill_id": 9 }.'),
    fields: fieldsSchema
  }, async ({ table, key, fields }) => tableOf(table).get(key, fields));

  registerTool(server, 'create_story', 'Create a story turn for a player character. Checks the character, its owner, the place and any dialogue link, then refreshes the player\'s open game tab.', {
    character_id: positiveId.describe('characters.id of a player character.'),
    user_id: z.string().min(1).max(MCP_DB.MAX_KEY_TEXT_LENGTH).optional().describe('Optional owner check: must equal the character\'s user_id.'),
    story: storyText.min(1).describe('The narration text.'),
    ...storyFieldsShape
  }, async (input) => createStory(input));

  registerTool(server, 'update_story', 'Edit an existing story turn. user_id and character_id cannot change. Send null to clear a nullable field. Refreshes the player\'s open game tab.', {
    id: positiveId.describe('stories.id'),
    story: storyText.min(1).optional().describe('New narration text.'),
    ...storyFieldsShape
  }, async (input) => updateStory(input));
}
