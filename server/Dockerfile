# Multi-stage build for NestJS backend
FROM node:20-alpine AS builder

# Set DNS servers for better network reliability during build
RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf && \
  echo "nameserver 8.8.4.4" >> /etc/resolv.conf || true

# Install curl for testing CDN connectivity
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies for build)
# Increase timeout and retry for npm install (fixes network timeout issues)
RUN npm config set fetch-timeout 300000 && \
  npm config set fetch-retries 5 && \
  npm config set fetch-retry-mintimeout 20000 && \
  npm config set fetch-retry-maxtimeout 120000 && \
  npm ci && \
  npm install prisma@^6.18.0 @prisma/client@^6.18.0 && \
  npm cache clean --force

# Copy source code
COPY . .

# Test CDN connectivity before generating Prisma Client
RUN echo "Testing Prisma CDN connectivity..." && \
  curl -I https://binaries.prisma.sh/ 2>&1 | head -3 || echo "CDN test completed"

# Generate Prisma Client with increased timeouts and retries
# Set environment variables for Prisma binary download
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
RUN npx prisma generate --schema=./prisma/schema.prisma || \
  (echo "Prisma generate failed, retrying..." && sleep 10 && npx prisma generate --schema=./prisma/schema.prisma)

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Set DNS servers for better network reliability during build
RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf && \
  echo "nameserver 8.8.4.4" >> /etc/resolv.conf || true

WORKDIR /app

# Install wget for healthcheck and netcat for entrypoint
RUN apk add --no-cache wget netcat-openbsd postgresql-client

# Install production dependencies only (including prisma for migrations)
COPY package*.json ./
COPY prisma ./prisma/

# Increase timeout and retry for npm install (fixes network timeout issues)
RUN npm config set fetch-timeout 300000 && \
  npm config set fetch-retries 5 && \
  npm config set fetch-retry-mintimeout 20000 && \
  npm config set fetch-retry-maxtimeout 120000 && \
  npm ci --omit=dev && \
  npm install prisma@^6.18.0 @prisma/client@^6.18.0 && \
  npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy Prisma Client from builder (already generated, no need to regenerate)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p uploads/screenshots uploads/thumbnails

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api || exit 1

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]

# Start the application
CMD ["node", "dist/main"]

