FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for build step)
RUN npm ci --prefer-offline --no-audit 2>&1 | grep -v "npm warn" || true

# ============================
FROM dependencies AS builder

WORKDIR /app

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# ============================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production --prefer-offline --no-audit 2>&1 | grep -v "npm warn" || true && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

USER appuser

CMD ["node", "dist/index.js"]

