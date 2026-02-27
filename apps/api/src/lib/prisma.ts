import { PrismaClient } from '@prisma/client';

// Deep-parse any string field that contains a JSON object or array.
// This handles the SQLite limitation where Json fields are stored as String.
function deepParseJson(data: unknown): unknown {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try { return JSON.parse(trimmed); } catch { /* not valid JSON */ }
    }
    return data;
  }
  if (Array.isArray(data)) return data.map(deepParseJson);
  // Preserve Date objects — Object.entries(Date) returns [] which would wipe dates
  if (data instanceof Date) return data;
  if (data !== null && typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      out[k] = deepParseJson(v);
    }
    return out;
  }
  return data;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Auto-parse JSON string fields returned from SQLite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$use(async (params: any, next: any) => {
    const result = await next(params);
    return deepParseJson(result);
  });

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
