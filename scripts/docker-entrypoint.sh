#!/bin/sh
set -eu

# Run migrations on container start when RUN_MIGRATIONS is set. Idempotent
# (drizzle-kit only applies pending migrations) so safe to set on every
# Fly machine boot.
if [ -n "${RUN_MIGRATIONS:-}" ]; then
  echo "Running migrations..."
  node /app/node_modules/drizzle-kit/bin.cjs migrate
fi

exec node /app/server.js
