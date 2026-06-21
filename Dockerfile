# syntax=docker/dockerfile:1

# ────────────────────────────────────────────────
# Stage 1: Build
# ────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build Vite frontend + bundle server.ts
RUN npm run build

# ────────────────────────────────────────────────
# Stage 2: Runtime (API Service)
# ────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Expose port (Cloud Run uses $PORT, default 8080)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
