FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --only=production && npm install --only=development

# Copy source and build
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production dependencies and built assets
COPY package.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist

# Healthcheck endpoint
EXPOSE 3000

USER appuser

CMD ["node", "dist/index.js"]

