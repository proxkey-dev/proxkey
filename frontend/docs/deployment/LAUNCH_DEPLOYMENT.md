# ProxKey Launch Deployment

## 1. Production env checklist

Frontend:

- `VITE_API_BASE_URL=https://api.proxkey.dev`
- `VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com`
- `VITE_AUTH0_CLIENT_ID=your_auth0_spa_client_id`
- `VITE_AUTH0_AUDIENCE=https://api.proxkey.dev`
- `VITE_AUTH0_CALLBACK_URL=https://app.proxkey.dev/callback`

Backend:

- `NODE_ENV=production`
- `PORT=4000`
- `DATABASE_URL=...`
- `FRONTEND_ORIGIN=https://app.proxkey.dev`
- `COOKIE_DOMAIN=.proxkey.dev`
- `SESSION_COOKIE_NAME=proxkey_session`
- `SESSION_TTL_HOURS=168`
- `AUTH0_DOMAIN=your-tenant.us.auth0.com`
- `AUTH0_AUDIENCE=https://api.proxkey.dev`
- `AUTH0_ISSUER_BASE_URL=https://your-tenant.us.auth0.com/`
- `AI_PROVIDER=openai` or `heuristic`
- `AI_BASE_URL=...` when using a compatible gateway
- `AI_API_KEY=...`
- `AI_MODEL=...`
- `REDIS_URL=...` when enabling BullMQ
- `REDIS_ENABLED=true` when using Redis workers
- `USE_INLINE_QUEUE=false` when using Redis workers
- `ENABLE_OVERAGES=false` unless explicitly enabled
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`
- `STRIPE_PRICE_FOUNDER=...`
- `STRIPE_PRICE_TEAM=...`
- `STRIPE_PRICE_GROWTH=...`

## 2. Database migration command

```bash
cd /Users/omer/Local_Repo/proxkey/frontend/server
npm run prisma:generate
npm run prisma:push
```

## 3. Railway backend deployment

1. Create a Railway project for the backend.
2. Point Railway at `/Users/omer/Local_Repo/proxkey/frontend/server`.
3. Set the start command to `npm run start`.
4. Set the build command to `npm run build`.
5. Add the backend env vars from the checklist above.

## 4. Railway Postgres and Redis connection

1. Add a Railway Postgres service and copy its connection string into `DATABASE_URL`.
2. Add a Railway Redis service and copy its connection string into `REDIS_URL`.
3. Set `REDIS_ENABLED=true`.
4. Set `USE_INLINE_QUEUE=false`.

## 5. Vercel frontend deployment

1. Import `/Users/omer/Local_Repo/proxkey/frontend` into Vercel.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set `VITE_API_BASE_URL=https://api.proxkey.dev`
5. Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, and `VITE_AUTH0_CALLBACK_URL`

## 6. Required domains

- `app.proxkey.dev` -> Vercel frontend
- `api.proxkey.dev` -> Railway backend

## 7. CORS and cookie settings

- Backend `FRONTEND_ORIGIN=https://app.proxkey.dev,http://localhost:5173`
- Backend `COOKIE_DOMAIN=.proxkey.dev`
- Cookie policy stays `HttpOnly`, `SameSite=Lax`, `Secure=true` in production
- Frontend sends `Authorization: Bearer <auth0_access_token>` to the API
- Auth0 allowed callback URL: `https://app.proxkey.dev/callback`
- Auth0 allowed logout URL: `https://app.proxkey.dev`
- Auth0 allowed web origin: `https://app.proxkey.dev`

## 8. Stripe webhook path

Current backend surface reserves billing hooks through:

- `POST /api/billing/checkout`
- `POST /api/billing/portal`

If Stripe is connected next, expose:

- `POST /webhooks/stripe`

and register that URL in Stripe with the signing secret stored in `STRIPE_WEBHOOK_SECRET`.

## 9. First admin account creation

1. Open `https://app.proxkey.dev/signup?plan=team`
2. Complete Auth0 Universal Login with a real work email.
3. Create the first workspace name in the signup flow.
4. ProxKey bootstraps the first local user/org from the Auth0 identity.
5. Finish onboarding by generating the first packet.

## 10. Smoke test checklist

- Sign up
- Login
- Auth0 redirect returns through `/callback` and lands on `/dashboard`
- Create workspace
- Create packet from onboarding
- Confirm the AI result completes
- Confirm dashboard usage updates
- Confirm pricing CTA routes to signup or billing
- Confirm billing returns a clean `billing_not_configured` path when Stripe is absent
- Create an API key
- Submit a packet through CLI or API key auth
- Logout
- Confirm unauthorized packet access is blocked across organizations
