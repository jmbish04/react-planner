#!/bin/bash
set -e

echo "🚀 Cloudflare Architecture Deployment Script"
echo "=============================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler is not installed"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Cloudflare"
    echo "Login with: wrangler login"
    exit 1
fi

echo "✅ Wrangler is installed and authenticated"

# Step 1: Create D1 database (if not exists)
echo ""
echo "📦 Step 1: Database Setup"
echo "-------------------------"
read -p "Do you need to create a new D1 database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating D1 database..."
    wrangler d1 create colby_floorplan_db
    echo ""
    echo "⚠️  IMPORTANT: Copy the database_id from above and update wrangler.jsonc"
    echo "Press Enter when done..."
    read
fi

# Step 2: Run migrations
echo ""
echo "🔄 Step 2: Running Database Migrations"
echo "--------------------------------------"
npm run db:migrate
echo "✅ Migrations completed"

# Step 3: Set secrets
echo ""
echo "🔐 Step 3: Configure Secrets"
echo "----------------------------"
read -p "Do you need to set IMAGES_API_TOKEN? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler secret put IMAGES_API_TOKEN
fi

# Step 4: Deploy
echo ""
echo "🚢 Step 4: Deploying to Cloudflare Workers"
echo "------------------------------------------"
npm run wrangler:deploy

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Visit your worker URL to test the /health endpoint"
echo "2. Configure your frontend to connect to the worker"
echo "3. Test WebSocket connections via /agents/*"
echo ""
