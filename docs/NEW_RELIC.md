# New Relic (logs / APM)

## What this is

Every backend service (API Gateway + all 5 services) has the New Relic Node.js agent wired in. Once configured, each service reports as its own named entity in New Relic — `api-gateway`, `order-service`, `payment-service`, `inventory-service`, `delivery-service`, `notification-service` — with its own logs, errors, and performance data.

## One-time setup (you only need to do this once)

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and paste your New Relic **License key** (the "INGEST - LICENSE" type key from [one.newrelic.com](https://one.newrelic.com) → account menu → API keys) into `NEW_RELIC_LICENSE_KEY=`.
3. That's it — `.env` is gitignored, so the key never gets committed. Every service reads it automatically on startup.

## How it's wired

- `.env` lives at the project root. Each service loads it via `dotenv` at the very top of its `index.js`, before anything else runs.
- `require('newrelic')` is the first import in every service's `index.js` — the agent requires this ordering to properly instrument Express and other libraries.
- Each service sets its own `NEW_RELIC_APP_NAME` directly in its `package.json` start script (e.g. `services/order-service/package.json`), so they show up as separate entities in New Relic instead of one blob.
- `NEW_RELIC_NO_CONFIG_FILE=true` (set in `.env`) tells the agent to configure itself entirely from environment variables instead of requiring a `newrelic.js` file per service.

## What happens if the key is missing or wrong

The agent fails to start and logs a clear error to the console — but **the service itself keeps running normally**. A New Relic problem never takes down the app; it just means that service temporarily isn't reporting data.

## Verifying it's working

Once `.env` has a real key, start everything (`npm run dev:all`) and place an order. Within a minute or two, you should see the 6 service names appear under **APM & Services** in your New Relic dashboard, each with real request data from the orders you placed.
