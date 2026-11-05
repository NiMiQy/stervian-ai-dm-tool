import { ERROR_NAMES } from '../../../configs/constants.js';

export class McpInputError extends Error {
  constructor(message) {
    super(message);
    this.name = ERROR_NAMES.LOOKUP_INPUT;
  }
}

export const isMcpInputError = (error) => error?.name === ERROR_NAMES.LOOKUP_INPUT;
