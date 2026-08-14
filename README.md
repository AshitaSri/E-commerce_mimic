# ecommerce-mimic

A small e-commerce order pipeline built as separate Node.js microservices, connected by Kafka events, each with its own Postgres database, plus a React UI for placing orders and watching them move through the pipeline. It exists to give the [RCA (root cause analysis) engine](#why-this-exists) something real to diagnose — a system with actual services, actual databases, and an actual message broker, so we can later inject realistic failures and test whether the RCA engine can find them.

- **What is this / how does it work?** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **How do I run it and try it out?** → [docs/RUNNING.md](docs/RUNNING.md)

## Project structure

```
ecommerce_mimic/
  docker-compose.yml       # Kafka, Redis, Postgres — the shared infrastructure
  docker/postgres-init/    # creates the 5 per-service Postgres databases on first boot
  shared/                  # Kafka + Postgres helper code, reused by every service
  services/
    api-gateway/           # the only entry point for HTTP traffic (:3000)
    order-service/         # :3001
    payment-service/       # :3002
    inventory-service/     # :3003
    delivery-service/      # :3004
    notification-service/  # :3005
  frontend/                # React (Vite) UI — order form + live pipeline status (:5173)
  docs/                    # architecture + running/testing guides
```

## Quick start

```bash
docker compose up -d   # Kafka + Redis + Postgres
npm install
npm run dev:all         # starts all 6 backend services AND the UI together
```

Then open **http://localhost:5173** and place an order through the form — or, without the UI:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":"ashita","items":[{"sku":"SKU-1","qty":2}],"total":49.99}'
```

Full walkthrough, including how to check each service actually did its job, is in [docs/RUNNING.md](docs/RUNNING.md).

## Why this exists

This app is the *target* system, not the RCA tool itself. The plan is to later inject bugs into it (a bad deployment, a config change, a resource leak) and point a hypothesis-driven, graph-based RCA agent at the resulting incident — the agent traces symptoms back through logs, database state, deploy history, and code changes to find the root cause. Having a real multi-service system with a real event bus and real per-service databases means the RCA engine has genuine evidence to search through, not a simulation of one.
