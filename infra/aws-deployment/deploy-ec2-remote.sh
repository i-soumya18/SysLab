#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/infra/aws-deployment"

: "${PUBLIC_HOST:?PUBLIC_HOST is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET is required}"

# Build and roll out services in-place.
PUBLIC_HOST="$PUBLIC_HOST" \
JWT_SECRET="$JWT_SECRET" \
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  docker compose -f docker-compose.ec2.yml up -d --build --remove-orphans

# Light housekeeping to control disk usage on small instances.
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
