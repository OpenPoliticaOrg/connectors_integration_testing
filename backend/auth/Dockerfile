# Auth Service Dockerfile
# Build from monorepo root: docker build -f backend/auth/Dockerfile -t auth-service .

# ============================================
# Stage 1: Prune the monorepo
# ============================================
FROM oven/bun:1.3.8-alpine AS pruner

WORKDIR /app

# Install turbo
RUN bun add -g turbo@^2.8.7

# Copy the monorepo
COPY . .

# Prune to only what auth service needs
RUN turbo prune @backend/auth --docker

# ============================================
# Stage 2: Install dependencies
# ============================================
FROM oven/bun:1.3.8-alpine AS installer

WORKDIR /app

# Copy package.json files from pruner
COPY --from=pruner /app/out/json/ .

# Copy lockfile (turbo prune creates bun.lock)
COPY --from=pruner /app/out/bun.lock ./bun.lock

# Install dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Build
# ============================================
FROM oven/bun:1.3.8-alpine AS builder

WORKDIR /app

# Copy dependencies and source
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/backend ./backend
COPY --from=installer /app/packages ./packages
COPY --from=pruner /app/out/full/ .

# Set environment for build
ENV NODE_ENV=production

# ============================================
# Stage 4: Production runner
# ============================================
FROM oven/bun:1.3.8-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 bunjs
RUN adduser --system --uid 1001 bunuser

# Install curl for health check
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/packages ./packages

# Set ownership
RUN chown -R bunuser:bunjs /app

USER bunuser

# Environment defaults
ENV NODE_ENV=production
ENV PORT=5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

EXPOSE 5001

# Start the service
CMD ["bun", "run", "backend/auth/src/index.ts"]
