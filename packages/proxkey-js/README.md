# `@proxkey/proxkey-js`

```bash
npm install @proxkey/proxkey-js
```

```ts
import { createClient } from '@proxkey/proxkey-js'

const client = createClient({
  apiKey: process.env.PROXKEY_API_KEY,
  baseUrl: 'https://api.proxkey.dev',
})

const packet = await client.triage.generate({
  rawInput: 'Checkout hangs after Apple Pay confirmation...',
  source: 'support',
})
```
