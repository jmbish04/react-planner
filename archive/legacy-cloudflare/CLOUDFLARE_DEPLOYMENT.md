# Cloudflare Workers Deployment Guide

## Prerequisites

- Node.js 20.11.0 or higher (see `.nvmrc` and `.node-version`)
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Workers enabled
- Cloudflare D1 database access
- Cloudflare Images API token

## Node.js Version

This project requires **Node.js 20.11.0** for Cloudflare Workers deployment. The older React demo still works with Node 16, but the Cloudflare Workers backend requires a modern Node version.

Make sure you're using the correct Node version:

```bash
# Using nvm
nvm use

# Or check your version
node --version  # Should be 20.11.0 or higher
```

## Quick Deployment

### Option 1: Automated Deployment Script

```bash
chmod +x ./deploy.sh
./deploy.sh
```

### Option 2: Manual Step-by-Step

```bash
# 1. Install dependencies
npm install

# 2. Configure Cloudflare Account
# Edit wrangler.jsonc and set your CLOUDFLARE_ACCOUNT_ID

# 3. Create D1 Database
wrangler d1 create colby_floorplan_db
# Copy the database_id from output and update wrangler.jsonc

# 4. Set Secrets
wrangler secret put IMAGES_API_TOKEN

# 5. Deploy using the comprehensive script
npm run deploy
```

The `npm run deploy` command will:
1. Generate Drizzle ORM migrations
2. Apply migrations to remote D1 database
3. Deploy Workers with minification enabled

## Development

```bash
# Local development with live reload
npm run wrangler:dev
```

## Build Configuration

The Cloudflare Workers deployment uses:
- **Compatibility Date**: 2026-05-25
- **Compatibility Flags**: `nodejs_compat`
- **Main Entry**: `src/backend/index.ts` (TypeScript, transpiled by Wrangler)
- **Assets**: `./dist` directory
- **Node Version**: 20.11.0

## Troubleshooting

### Build Failures

If you encounter "Installing nodejs" failures:
1. Check `.nvmrc` and `.node-version` files specify Node 20+
2. Ensure your local Node version matches
3. Clear Wrangler cache: `rm -rf .wrangler`
4. Try deploying again

### TypeScript Errors

Wrangler automatically transpiles TypeScript. No separate build step needed.

### D1 Migration Failures

```bash
# List existing migrations
wrangler d1 migrations list colby_floorplan_db

# Apply migrations manually
wrangler d1 migrations apply colby_floorplan_db --remote
```

### Worker Deployment Timeouts

If deployment times out, try:
```bash
# Deploy with increased timeout
wrangler deploy --minify --compatibility-date=2026-05-25
```

## Environment Variables

Required in `wrangler.jsonc`:
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

Required as secrets (set via `wrangler secret put`):
- `IMAGES_API_TOKEN`: Cloudflare Images API token

## Architecture Notes

- **Durable Objects**: Requires paid Workers plan
- **D1 Database**: Currently in beta, check Cloudflare status
- **Browser Run**: Requires Browser Rendering API access
- **AI Gateway**: Requires Workers AI access

## Deployment Checklist

- [ ] Node.js 20.11.0 installed
- [ ] Wrangler CLI installed and authenticated
- [ ] Cloudflare account ID configured in wrangler.jsonc
- [ ] D1 database created and ID updated
- [ ] IMAGES_API_TOKEN secret set
- [ ] Dependencies installed (`npm install`)
- [ ] Migrations applied (`npm run db:migrate`)
- [ ] Worker deployed (`npm run wrangler:deploy`)

## Support

For Cloudflare-specific issues:
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
