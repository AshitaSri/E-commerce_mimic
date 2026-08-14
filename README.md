# ecommerce-mimic

A small e-commerce order pipeline built as separate Node.js microservices, connected by Kafka events, each with its own SQLite database. It exists to give the [RCA (root cause analysis) engine](#why-this-exists) something real to diagnose — a system with actual services, actual databases, and an actual message broker, so we can later inject realistic failures and test whether the RCA engine can find them.

- **What is this / how does it work?** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **How do I run it and try it out?** → [docs/RUNNING.md](docs/RUNNING.md)

## Quick start

```bash
docker compose up -d   # Kafka + Redis
npm install
npm run dev             # starts all 6 services
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":"ashita","items":[{"sku":"SKU-1","qty":2}],"total":49.99}'
```

Full walkthrough, including how to check each service actually did its job, is in [docs/RUNNING.md](docs/RUNNING.md).

## Why this exists

This app is the *target* system, not the RCA tool itself. The plan is to later inject bugs into it (a bad deployment, a config change, a resource leak) and point a hypothesis-driven, graph-based RCA agent at the resulting incident — the agent traces symptoms back through logs, database state, deploy history, and code changes to find the root cause. Having a real multi-service system with a real event bus and real per-service databases means the RCA engine has genuine evidence to search through, not a simulation of one.
