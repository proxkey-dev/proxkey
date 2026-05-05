#!/bin/bash

# Test the demo endpoint
echo "Testing ProxKey Demo Endpoint..."
echo ""

# Demo token and policy
TOKEN='pk_demo_eyJhbGciOiJIUzI1NiIsInR5cCI6IlBLREVNTyJ9.eyJraWQiOiJkZW1vLTEyMzQiLCJ0dGxNaW51dGVzIjoxNSwibWF4UmVxdWVzdHMiOjEwLCJzY29wZSI6WyJyZWFkIl0sImdlb2ZlbmNlIjpbIlVTIiwiR0IiXSwiaXNzdWVkQXQiOjE3Mjc0NjAwMDB9.hLZ_b64URL_SIG'
POLICY_B64URL='eyJraWQiOiJkZW1vLTEyMzQiLCJ0dGxNaW51dGVzIjoxNSwibWF4UmVxdWVzdHMiOjEwLCJzY29wZSI6WyJyZWFkIl0sImdlb2ZlbmNlIjpbIlVTIiwiR0IiXSwiaXNzdWVkQXQiOjE3Mjc0NjAwMDB9'

echo "Making request to demo endpoint..."
echo ""

curl -s "https://proxkey-demo.workers.dev/demo/echo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-ProxKey-Policy: $POLICY_B64URL" | jq .

echo ""
echo "Demo endpoint test completed!"
