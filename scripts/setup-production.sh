#!/bin/bash

# Aedra Production Setup Script
# This script sets up the entire application on a fresh Linux server.
#
# Image notes:
#   - Production uses kartoza/postgis (multi-arch, ARM64 compatible)
#   - Local dev uses postgis/postgis (x86 only)
#   docker-compose.prod.yml handles the image swap via Docker Compose override.

set -e

echo "🚀 Starting Aedra Production Setup..."

# 1. Dependency Check
if ! [ -x "$(command -v docker)" ]; then
  echo "📦 Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  rm get-docker.sh
fi

if ! [ -x "$(command -v docker-compose)" ]; then
  echo "📦 Installing Docker Compose..."
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

if ! [ -x "$(command -v nginx)" ]; then
  echo "🌐 Installing Nginx and DNS tools..."
  sudo apt-get update
  sudo apt-get install -y nginx certbot python3-certbot-nginx dnsutils
fi

# 2. Environment Variables
echo "🔑 Configuring Environment Variables..."

# Generate a random secret for AUTH_SESSION_SECRET
RANDOM_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo '')

# API .env
if [ ! -f api/.env ]; then
  echo "Creating api/.env..."
  cat <<EOF > api/.env
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/aedra?schema=public"
AUTH_SESSION_SECRET="$RANDOM_SECRET"
CORS_ALLOWED_ORIGINS="https://aedra.homeet.site"
REDIS_HOST="redis"
REDIS_PORT=6379
PORT=3001
NODE_ENV="production"
EOF
fi

# Web .env
if [ ! -f web/.env ]; then
  echo "Creating web/.env..."
  cat <<EOF > web/.env
AEDRA_API_URL="http://aedra-api:3001"
NEXT_PUBLIC_AEDRA_API_URL="https://aedra.homeet.site/api"
NODE_ENV="production"
EOF
fi

# 3. Nginx Configuration
echo "🌐 Configuring Nginx for Cloudflare Proxy..."
DOMAIN="aedra.homeet.site"
NGINX_PATH="/etc/nginx/sites-available/aedra"

# Use Cloudflare-specific config (No local SSL)
sudo cp deploy/nginx/aedra.cloudflare.conf $NGINX_PATH
sudo ln -sf $NGINX_PATH /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Restart Nginx
sudo systemctl reload nginx || sudo systemctl restart nginx

# 4. Build and Start Services
echo "🏗️ Building and starting Docker services..."
export NEXT_PUBLIC_AEDRA_API_URL="https://aedra.homeet.site/api"

DC="docker-compose -f docker-compose.yml -f docker-compose.prod.yml"

$DC down || true
$DC pull
$DC up --build -d

echo "⏳ Waiting for API to be ready..."
until [ "`docker inspect -f {{.State.Running}} aedra-api`"=="true" ]; do
    sleep 2
done

# Wait for NestJS and Postgres to fully initialize
echo "⏳ Waiting for database to be ready (PostGIS initialization can take ~30s)..."
# Use -h localhost to force TCP connection check and avoid Peer authentication issues in the container
until docker exec aedra-postgres pg_isready -h localhost -U postgres; do
    echo "   ...still waiting for postgres..."
    sleep 3
done
echo "✅ Database is ready!"
# Kartoza image often needs a bit more time after pg_isready to finish internal setup (extensions, etc.)
echo "⏳ Waiting an additional 15s for final PostGIS setup..."
sleep 15

# 5. Migrations and Seeding
echo "🏗️ Running migrations..."
# Directly run the migration and if it fails, let the script stop so we see the error.
# We also pass the DATABASE_URL explicitly from the container env for extra certainty.
$DC exec -T aedra-api sh -c 'DATABASE_URL=$DATABASE_URL npx prisma migrate deploy --schema ./prisma/schema.prisma'
echo "✅ Migrations completed!"

# Seeding is optional to avoid overwriting production data
if [ "$ENABLE_SEED" = "true" ]; then
    echo "🌱 Seeding database..."
    $DC exec -T aedra-api npx prisma db seed -- --schema ./prisma/schema.prisma
else
    echo "⏭️ Skipping seeding. Set ENABLE_SEED=true to seed the database."
fi

echo "✅ Aedra setup completed successfully!"

