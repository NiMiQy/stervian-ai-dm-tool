import prisma from '../../prismaClient.js';
import { databaseError } from '../../../database/databaseError.js';
import { MCP_DB, MCP_DB_FIELD_TYPE, MCP_DB_MESSAGES, MCP_DB_OPERATOR } from '../../../configs/constants.js';
import { McpInputError, isMcpInputError } from './mcpError.js';

const { STRING, INT, FLOAT, BOOLEAN, DATE_TIME, ENUM, JSON_DATA, BYTES } = MCP_DB_FIELD_TYPE;
const OP = MCP_DB_OPERATOR;

const OPERATORS_BY_TYPE = Object.freeze({
  [STRING]: [OP.EQUALS, OP.NOT, OP.CONTAINS, OP.STARTS_WITH, OP.ENDS_WITH, OP.IN, OP.IS_NULL],
  [INT]: [OP.EQUALS, OP.NOT, OP.GT, OP.GTE, OP.LT, OP.LTE, OP.IN, OP.IS_NULL],
  [FLOAT]: [OP.EQUALS, OP.NOT, OP.GT, OP.GTE, OP.LT, OP.LTE, OP.IS_NULL],
  [BOOLEAN]: [OP.EQUALS, OP.IS_NULL],
  [DATE_TIME]: [OP.EQUALS, OP.GT, OP.GTE, OP.LT, OP.LTE, OP.IS_NULL],
  [ENUM]: [OP.EQUALS, OP.NOT, OP.IN, OP.IS_NULL],
  [JSON_DATA]: [],
  [BYTES]: []
});

function coerceValue(table, name, field, value) {
  const fail = () => { throw new McpInputError(`${table}.${name} expects ${field.type === ENUM ? `one of ${field.values.join(', ')}` : field.type}.`); };
  switch (field.type) {
    case STRING:
      if (typeof value !== 'string' || value.length > MCP_DB.MAX_TEXT_LENGTH) fail();
      return value;
    case INT:
      if (!Number.isInteger(value)) fail();
      return value;
    case FLOAT:
      if (typeof value !== 'number' || !Number.isFinite(value)) fail();
      return value;
    case BOOLEAN:
      if (typeof value !== 'boolean') fail();
      return value;
    case DATE_TIME: {
      const date = typeof value === 'string' ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) fail();
      return date;
    }
    case ENUM:
      if (!field.values.includes(value)) fail();
      return value;
    default:
      return fail();
  }
}

function buildCondition(spec, filter) {
  const { field: name, op, value } = filter;
  const field = spec.fields[name];
  if (!field || spec.hidden.has(name)) throw new McpInputError(`${spec.table} has no searchable field "${name}".`);
  if (!OPERATORS_BY_TYPE[field.type].includes(op)) {
    throw new McpInputError(`${spec.table}.${name} (${field.type}) does not support "${op}". Use: ${OPERATORS_BY_TYPE[field.type].join(', ') || 'none'}.`);
  }
  if (op === OP.IS_NULL) {
    if (typeof value !== 'boolean') throw new McpInputError(`"${OP.IS_NULL}" expects true or false.`);
    if (!field.nullable) throw new McpInputError(`${spec.table}.${name} is never null.`);
    return { [name]: value ? null : { not: null } };
  }
  if (op === OP.IN) {
    if (!Array.isArray(value) || !value.length || value.length > MCP_DB.MAX_IN_VALUES) {
      throw new McpInputError(`"${OP.IN}" expects a list of 1 to ${MCP_DB.MAX_IN_VALUES} values.`);
    }
    return { [name]: { in: value.map((entry) => coerceValue(spec.table, name, field, entry)) } };
  }
  const coerced = coerceValue(spec.table, name, field, value);
  if (op === OP.EQUALS) return { [name]: coerced };
  return { [name]: { [op]: coerced } };
}

function buildWhere(spec, { filters = [], match = MCP_DB.MATCH_ALL, includeDeleted = false } = {}) {
  if (filters.length > MCP_DB.MAX_FILTERS) throw new McpInputError(`Use at most ${MCP_DB.MAX_FILTERS} filters.`);
  const conditions = filters.map((filter) => buildCondition(spec, filter));
  const and = [];
  if (conditions.length) and.push(match === MCP_DB.MATCH_ANY ? { OR: conditions } : { AND: conditions });
  if (spec.softDelete && !includeDeleted) and.push({ OR: [{ deleted: false }, { deleted: null }] });
  return and.length ? { AND: and } : {};
}

function buildSelect(spec, requested) {
  const names = requested?.length ? requested : spec.visibleFields;
  const select = {};
  for (const name of names) {
    if (!spec.fields[name] || spec.hidden.has(name)) throw new McpInputError(`${spec.table} has no readable field "${name}".`);
    select[name] = true;
  }
  return select;
}

function buildOrderBy(spec, orderBy) {
  if (!orderBy) return spec.defaultOrderBy;
  const field = spec.fields[orderBy.field];
  if (!field || spec.hidden.has(orderBy.field) || [JSON_DATA, BYTES].includes(field.type)) {
    throw new McpInputError(`${spec.table} cannot be sorted by "${orderBy.field}".`);
  }
  return [{ [orderBy.field]: orderBy.direction === MCP_DB.SORT_DESC ? MCP_DB.SORT_DESC : MCP_DB.SORT_ASC }];
}

function keyWhere(spec, key = {}) {
  const where = {};
  for (const name of spec.keys) {
    if (key[name] === undefined || key[name] === null) throw new McpInputError(`${spec.table} needs key ${spec.keys.join(' + ')}.`);
    where[name] = coerceValue(spec.table, name, spec.fields[name], key[name]);
  }
  return where;
}

async function run(spec, operation, task) {
  try {
    return await task();
  } catch (error) {
    if (isMcpInputError(error)) throw error;
    throw databaseError(`mcp.${spec.table}`, operation, error);
  }
}

export function defineTable({ table, keys, fields, hidden = [], description = '', writable = false }) {
  const normalizedFields = Object.freeze(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, Object.freeze({ nullable: false, ...field })])));
  const hiddenSet = new Set([...hidden, ...Object.entries(normalizedFields).filter(([, field]) => field.type === BYTES).map(([name]) => name)]);
  const spec = {
    table,
    description,
    writable,
    keys: Object.freeze([...keys]),
    fields: normalizedFields,
    hidden: hiddenSet,
    softDelete: Boolean(normalizedFields.deleted),
    visibleFields: Object.freeze(Object.keys(normalizedFields).filter((name) => !hiddenSet.has(name))),
    defaultOrderBy: keys.map((name) => ({ [name]: MCP_DB.SORT_ASC }))
  };

  const describe = () => ({
    table,
    description,
    writable,
    keys: spec.keys,
    softDelete: spec.softDelete,
    fields: spec.visibleFields.map((name) => {
      const field = normalizedFields[name];
      return {
        name,
        type: field.type,
        nullable: field.nullable,
        ...(field.values ? { values: field.values } : {}),
        operators: OPERATORS_BY_TYPE[field.type]
      };
    }),
    hiddenFields: [...hiddenSet]
  });

  const search = (input = {}) => run(spec, 'search', async () => {
    const take = Math.min(input.limit ?? MCP_DB.DEFAULT_LIMIT, MCP_DB.MAX_LIMIT);
    const skip = input.offset ?? 0;
    const where = buildWhere(spec, input);
    const select = buildSelect(spec, input.fields);
    const orderBy = buildOrderBy(spec, input.orderBy);
    const delegate = prisma[table];
    const [total, results] = await Promise.all([
      delegate.count({ where }),
      delegate.findMany({ where, select, orderBy, take, skip })
    ]);
    return { table, total, limit: take, offset: skip, results };
  });

  const get = (key, requestedFields) => run(spec, 'get', async () => {
    const record = await prisma[table].findFirst({ where: keyWhere(spec, key), select: buildSelect(spec, requestedFields) });
    if (!record) throw new McpInputError(MCP_DB_MESSAGES.NOT_FOUND);
    return { table, record };
  });

  return Object.freeze({ ...spec, describe, search, get });
}
