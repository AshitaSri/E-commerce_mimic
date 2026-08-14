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

## Why only 2 of the 6 services show throughput by default

New Relic automatically tracks **HTTP requests** as transactions. Only `api-gateway` and `order-service` handle direct HTTP requests, so out of the box they're the only two with visible response time/throughput data — `payment-service`, `inventory-service`, `delivery-service`, and `notification-service` only react to Kafka messages, which the agent doesn't track automatically.

To fix that, `shared/kafka.js`'s `consume()` wraps every Kafka message handler in `newrelic.startBackgroundTransaction(...)` (see the function for details). This makes each Kafka-triggered action — `Kafka/order.created`, `Kafka/payment.authorized`, etc. — show up as its own transaction, so all 6 services report real throughput and error data, not just the two that speak HTTP.

## Verifying it's working

Once `.env` has a real key, start everything (`npm run dev:all`) and place an order. Within a minute or two:

- **APM & Services** in New Relic should show all 6 service names with non-empty response time/throughput/error rate
- Note: your New Relic account may have other, unrelated entities listed too (from other projects/tests) — ours are exactly these 6 names, nothing more
- Clicking into any service (e.g. `payment-service`) → **Transactions** should show entries like `Kafka/order.created`, confirming the background-transaction wrapping is working
