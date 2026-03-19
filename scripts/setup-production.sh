#!/bin/bash

# Aedra Production Setup Script
# This script sets up the entire application on a fresh Linux server.
#
# Image notes:
#   - Production and local dev now both use postgis/postgis:15-3.4
#   - This image supports both x86_64 and ARM64 (AWS Graviton, etc.)
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
  
  # Generate a random verify token for WhatsApp
  META_VERIFY_TOKEN=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 16 ; echo '')
  
  # Ask for Meta API Token if not provided via env
  if [ -z "$META_API_TOKEN" ]; then
    echo "⚠️  META_API_TOKEN (System User Token) is required for WhatsApp messaging."
    read -p "Enter Meta API Token (or press Enter to skip and add later): " USER_META_TOKEN
    META_API_TOKEN=${USER_META_TOKEN:-"CHANGE_ME"}
  fi

  cat <<EOF > api/.env
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/aedra?schema=public"
AUTH_SESSION_SECRET="$RANDOM_SECRET"
CORS_ALLOWED_ORIGINS="https://aedra.homeet.site"
REDIS_HOST="redis"
REDIS_PORT=6379
PORT=4001
NODE_ENV="production"
GEMINI_API_KEY="$GEMINI_API_KEY"
GROQ_API_KEY="${GROQ_API_KEY:-dummy-key}"
META_VERIFY_TOKEN="$META_VERIFY_TOKEN"
META_API_TOKEN="$META_API_TOKEN"
EOF
  echo "✅ api/.env created."
fi

# Web .env
if [ ! -f web/.env ]; then
  echo "Creating web/.env..."
  cat <<EOF > web/.env
AEDRA_API_URL="http://aedra-api:4001"
NEXT_PUBLIC_AEDRA_API_URL="https://aedra.homeet.site/api"
NODE_ENV="production"
EOF
fi

# 3. Nginx Configuration
echo "🌐 Configuring Nginx for HTTPS (Full/Strict compatible)..."
DOMAIN="aedra.homeet.site"
NGINX_PATH="/etc/nginx/sites-available/aedra"

# Check if SSL certificates exist
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "🔑 SSL Certificates NOT found. Bootstrapping with minimal config..."
  sudo cp deploy/nginx/aedra-bootstrap.conf $NGINX_PATH
  sudo ln -sf $NGINX_PATH /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default
  
  # Ensure certbot directory exists
  sudo mkdir -p /var/www/certbot
  
  # Restart Nginx with bootstrap config
  sudo systemctl reload nginx || sudo systemctl restart nginx
  
  echo "🛡️  Obtaining SSL certificates via Certbot..."
  # Use --nginx or --webroot. Given we have a port 80 config with /.well-known/acme-challenge/
  # we use webroot mode which is very reliable.
  sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
    echo "❌ Certbot failed to obtain certificates. Check your DNS and domain name."
    exit 1
  }
  echo "✅ Certificates obtained."
fi

# Apply full TLS-enabled config
sudo cp deploy/nginx/aedra.conf $NGINX_PATH
sudo ln -sf $NGINX_PATH /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Final Restart Nginx
sudo systemctl reload nginx || sudo systemctl restart nginx

# 4. Build and Start Services
echo "🏗️ Building and starting Docker services..."
echo "🔒 Note: Database volumes (pgdata) are preserved during this process."
export NEXT_PUBLIC_AEDRA_API_URL="https://aedra.homeet.site/api"

DC="docker-compose -f docker-compose.yml -f docker-compose.prod.yml"

# Use stop instead of down to be even less destructive (though down is usually safe for volumes)
# We avoid '-v' to ensure data stays intact.
$DC stop || true
$DC pull
$DC up --build -d

echo "⏳ Waiting for API to be ready..."
until [ "`docker inspect -f {{.State.Running}} aedra-api`"=="true" ]; do
    sleep 2
done

# Wait for NestJS and Postgres to fully initialize
echo "⏳ Waiting for database to be ready (PostGIS initialization can take ~30s)..."
# Use -h localhost to force TCP connection check and avoid Peer authentication issues in the container
until docker exec aedra-postgres pg_isready -h localhost -p 5432 -U postgres; do
    echo "   ...still waiting for postgres..."
    sleep 3
done
echo "✅ Database is ready!"
# Kartoza image often needs a bit more time after pg_isready to finish internal setup (extensions, etc.)
echo "⏳ Waiting an additional 15s for final PostGIS setup..."
sleep 15

# 5. Run Migrations and Wait for API
echo "🔄 Running Prisma migrations inside the API container..."
# Give the container a few seconds to initialize its internal environment
sleep 5
docker exec aedra-api npx prisma migrate deploy --schema ./prisma/schema.prisma || {
    echo "❌ Migration failed! Checking logs..."
    docker logs aedra-api | tail -n 20
    exit 1
}
echo "✅ Migrations applied successfully."

echo "⏳ Waiting for API to come online..."
MAX_RETRIES=20
COUNT=0
until curl -sf http://localhost:4001/ > /dev/null 2>&1; do
    echo "   ...waiting for API ($COUNT/$MAX_RETRIES)..."
    sleep 3
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "❌ API failed to start in time. Checking logs..."
        docker logs aedra-api | tail -n 20
        exit 1
    fi
done

echo "✅ Aedra setup completed successfully!"
echo "🌍 Visit: https://$DOMAIN"

# WhatsApp Configuration Summary
# Extract the token directly from the .env file we just created/verified
WHATSAPP_VERIFY_TOKEN=$(grep META_VERIFY_TOKEN api/.env | cut -d'=' -f2 | tr -d '\"')

echo ""
echo "------------------------------------------------------"
echo "📲  WHATSAPP WEBHOOK CONFIGURATION (META SIDE)"
echo "------------------------------------------------------"
echo "Callback URL: https://$DOMAIN/messaging/whatsapp/webhook/system"
echo "Verify Token: $WHATSAPP_VERIFY_TOKEN"
echo "------------------------------------------------------"
echo "Note: Ensure 'messages' is subscribed in your Meta App."
