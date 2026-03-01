FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit 2>&1 | grep -v "npm warn" || true

# ============================
FROM dependencies AS builder

WORKDIR /app

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# ============================
FROM nginx:1.27-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist ./

COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
  listen 80;
  server_name _;

  root   /usr/share/nginx/html;
  index  index.html;

  # Cache busting for app shell
  location ~* \.html?$ {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
  }

  # Cache static assets (JS, CSS, images)
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Try files for SPA routing
  location / {
    try_files $uri $uri/ /index.html;
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
  }

  # API proxy
  location /api/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
  }

  # WebSocket for Socket.IO
  location /socket.io/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
  }

  # Gzip compression
  gzip on;
  gzip_vary on;
  gzip_types text/css text/javascript application/javascript application/json;
  gzip_min_length 1000;

  access_log /var/log/nginx/access.log;
  error_log  /var/log/nginx/error.log warn;
}
EOF

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1 || true

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

