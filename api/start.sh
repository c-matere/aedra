#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma
echo "✅ Migrations complete."

echo "🚀 Starting API server..."
exec node dist/src/main.js
