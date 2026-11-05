import prisma from '../../prismaClient.js';
import { MAX_HARNESS_ITERATIONS } from '../../../configs/constants.js';

export { MAX_HARNESS_ITERATIONS };

export function getPrismaClient(config = null) {
  return config?.configurable?.prisma || globalThis.prisma || prisma;
}
