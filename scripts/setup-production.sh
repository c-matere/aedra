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
  echo "🌐 Installing Nginx..."
  sudo apt-get update
  sudo apt-get install -y nginx certbot python3-certbot-nginx
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
CORS_ALLOWED_ORIGINS="https://aedra.nomeet.site"
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
NEXT_PUBLIC_AEDRA_API_URL="https://aedra.nomeet.site/api"
NODE_ENV="production"
EOF
fi

# 3. Nginx Configuration
echo "🌐 Configuring Nginx..."
DOMAIN="aedra.nomeet.site"
NGINX_PATH="/etc/nginx/sites-available/aedra"

sudo cp deploy/nginx/aedra.conf $NGINX_PATH
sudo ln -sf $NGINX_PATH /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# 4. SSL Certificate
echo "🔐 Setting up SSL with Certbot..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN || echo "⚠️ Certbot failed. Ensure your domain points to this IP."

# 5. Build and Start Services
echo "🏗️ Building and starting Docker services..."
export NEXT_PUBLIC_AEDRA_API_URL="https://aedra.nomeet.site/api"
docker-compose down || true
docker-compose up --build -d

echo "✅ Aedra is now setting up! Please wait a few minutes for the build to complete."
echo "🌍 Visit: https://$DOMAIN"
echo ""
echo "📝 Note: You might need to run migrations and seed the database once the API is up."
echo "   docker exec -it aedra-api npx prisma migrate deploy"
echo "   docker exec -it aedra-api npx prisma db seed"
