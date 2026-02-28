# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --filter api...

COPY apps/api ./apps/api
COPY prisma ./prisma

# Build TypeScript
RUN pnpm --filter api build

# Generate Prisma client
RUN pnpm --filter api prisma generate

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --filter api... --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

ENV NODE_ENV=production
EXPOSE 4000

# Run migrations then start
CMD ["sh", "-c", "pnpm --filter api prisma migrate deploy && node apps/api/dist/index.js"]
