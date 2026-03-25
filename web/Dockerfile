# Build context must be COMMAND-CENTRAL root (set in docker-compose.yml)
# so we can access both web/ and agents/ directories.

# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json* ./
RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .
RUN npm run build

# ── Stage 3: Production runner ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0

# Copy agent prompts into container for runtime loading
COPY agents/ /agents/

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001
CMD ["node", "server.js"]
