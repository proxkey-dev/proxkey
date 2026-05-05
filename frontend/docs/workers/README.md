# Workers

Current worker code lives outside the frontend app so `src/` remains the Vite product shell.

- `workers/demo-echo/worker.ts`: edge-only demo echo endpoint configured by the repo root [wrangler.toml](/Users/omer/Local_Repo/proxkey/frontend/wrangler.toml)
- `workers/demo-qr/`: standalone Cloudflare worker project for demo QR redirects

Helpful commands:

- `npm run deploy:demo`
- `npm run smoke:demo`
