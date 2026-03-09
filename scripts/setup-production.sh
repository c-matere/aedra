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
echo "🌐 Configuring Nginx (Bootstrap)..."
DOMAIN="aedra.homeet.site"
NGINX_PATH="/etc/nginx/sites-available/aedra"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

# 3a. DNS Check - HELP THE USER DEBUG
echo "🔍 Verifying DNS configuration for $DOMAIN..."
SERVER_IP=$(curl -s https://ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

if [ -z "$DOMAIN_IP" ]; then
    echo "❌ DNS Error: $DOMAIN does not have an A record. Please point it to $SERVER_IP in your DNS dashboard."
    exit 1
fi

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo "⚠️ Warning: $DOMAIN points to $DOMAIN_IP, but this server's public IP is $SERVER_IP."
    echo "   Ensure your DNS has propagated or check your firewall/load balancer."
fi

# 3a. Use bootstrap config if SSL cert doesn't exist yet
if [ ! -f "$CERT_PATH" ]; then
    echo "⚠️ Cert not found. Using bootstrap Nginx config."
    sudo cp deploy/nginx/aedra.bootstrap.conf $NGINX_PATH
else
    echo "✅ Cert found. Using full Nginx config."
    sudo cp deploy/nginx/aedra.conf $NGINX_PATH
fi

sudo ln -sf $NGINX_PATH /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Restart Nginx to apply bootstrap
sudo systemctl reload nginx || sudo systemctl restart nginx

# 4. SSL Certificate
echo "🔐 Setting up SSL with Certbot..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN --expand

# 4a. After certbot, we must use the full config
echo "🌐 Updating Nginx to full config..."
sudo cp deploy/nginx/aedra.conf $NGINX_PATH
sudo systemctl reload nginx

# 5. Build and Start Services
echo "🏗️ Building and starting Docker services..."
export NEXT_PUBLIC_AEDRA_API_URL="https://aedra.homeet.site/api"
docker-compose down || true
docker-compose up --build -d

echo "⏳ Waiting for API to be ready..."
until [ "`docker inspect -f {{.State.Running}} aedra-api`"=="true" ]; do
    sleep 2
done

# Wait for NestJS to actually start
sleep 5

echo "🏗️ Running migrations and seeding..."
docker exec aedra-api npx prisma migrate deploy
docker exec aedra-api npx prisma db seed

echo "✅ Aedra setup completed successfully!"
echo "🌍 Visit: https://$DOMAIN"

