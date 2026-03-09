#!/bin/bash

# Aedra Production Setup Script
# This script sets up the entire application on a fresh Linux server.

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
AEDRA_API_URL="http://api:3001"
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
docker-compose down || true
docker-compose pull
docker-compose up --build -d

echo "⏳ Waiting for API to be ready..."
until [ "`docker inspect -f {{.State.Running}} aedra-api`"=="true" ]; do
    sleep 2
done

# Wait for NestJS and Postgres to fully initialize
echo "⏳ Waiting for services to initialize..."
sleep 15

echo "🏗️ Running migrations and seeding..."
MAX_RETRIES=5
RETRY_COUNT=0

until docker exec aedra-api npx prisma migrate deploy; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Migrations failed after $MAX_RETRIES attempts. Please check container logs: docker logs aedra-postgres"
        exit 1
    fi
    echo "⚠️ Database not ready yet, retrying migrations in 5s ($RETRY_COUNT/$MAX_RETRIES)..."
    sleep 5
done

docker exec aedra-api npx prisma db seed

echo "✅ Aedra setup completed successfully!"
echo "🌍 Visit: https://$DOMAIN"

