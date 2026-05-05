#!/bin/bash

# Deploy the ProxKey demo worker to Cloudflare
echo "Deploying ProxKey Demo Worker to Cloudflare..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Deploy the worker
echo "Deploying worker..."
wrangler deploy

echo ""
echo "Demo worker deployed successfully!"
echo "Test it with: ./scripts/smoke/test-demo.sh"
