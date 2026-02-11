# Use the official Bun image
FROM oven/bun:1.1-slim

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY backend/package.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN bun install

# Copy source code
COPY backend/src ./src
COPY mcp-servers ./mcp-servers
COPY schema.sql ./

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun run -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["bun", "run", "src/index.ts"]
