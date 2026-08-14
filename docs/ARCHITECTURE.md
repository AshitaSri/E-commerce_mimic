# Architecture

## What this system does

A client places an order. That single request triggers a chain reaction across five independent services, coordinated entirely through Kafka events — no service calls another service directly except the API Gateway calling Order Service.

```
Client
  │  POST /orders
  ▼
API Gateway  (:3000)
  │  forwards to Order Service
  ▼
Order Service  (:3001) ───────► orders DB (Postgres)
  │                     └─────► Redis (order status cache)
  │
  │  publishes: order.created
  ▼
      Kafka topic: order.created
         │                          │
         ▼                          ▼
Payment Service (:3002)      Inventory Service (:3003)
  │  charges mock card         │  reserves stock
  ▼                            ▼
payments DB                inventory DB
  │                            │
  │ publishes:                 │ publishes:
  │ payment.authorized         │ inventory.reserved
  │ or payment.failed          │
  └──────────────┬─────────────┘
                 ▼
       Kafka topics: payment.authorized / payment.failed / inventory.reserved
                 │
                 ▼
      Delivery Service (:3004)
      waits for BOTH payment.authorized
      AND inventory.reserved for the
      same order before proceeding
                 │
                 ▼
            delivery DB
                 │
                 │ publishes: delivery.created
                 ▼
       Kafka topic: delivery.created
                 │
                 ▼
     Notification Service (:3005)
                 │
                 ▼
           notifications DB
```

## The services

| Service | Port | Owns | Listens for | Publishes |
|---|---|---|---|---|
| API Gateway | 3000 | — | HTTP from client | — (forwards to Order Service) |
| Order Service | 3001 | `orders` DB, Redis | HTTP `POST /orders` | `order.created` |
| Payment Service | 3002 | `payments` DB | `order.created` | `payment.authorized` / `payment.failed` |
| Inventory Service | 3003 | `inventory` DB | `order.created` | `inventory.reserved` |
| Delivery Service | 3004 | `delivery` DB | `payment.authorized`, `payment.failed`, `inventory.reserved` | `delivery.created` |
| Notification Service | 3005 | `notifications` DB | `delivery.created` | — |

Each service is a standalone Node/Express process with its own Postgres **database** — nothing shares a database, though for local-dev convenience they all live inside one Postgres server/container. That isolation is deliberate: it mirrors how real microservices are usually built (each service owns its data), and it means an RCA engine investigating an incident has to trace *across* service boundaries, not just query one shared table.

## Why Kafka instead of direct HTTP calls between services

Order Service doesn't call Payment Service or Inventory Service directly. Instead it publishes one event, `order.created`, to Kafka, and both of those services independently pick it up. Kafka is the delivery mechanism in between — think of it as a shared bulletin board rather than a phone call.

This buys two things relevant to what we're building next:

1. **Fan-out for free** — one event, two independent consumers (Payment and Inventory), each reacting without knowing the other exists.
2. **A believable failure surface** — real production incidents often involve the message bus itself (a consumer falls behind, a message never gets picked up, a topic partition misbehaves). If we used plain HTTP calls instead, that whole category of bug wouldn't exist for the RCA engine to ever find.

## The one piece of real coordination logic: Delivery Service's join

Every other service reacts to a single event. Delivery Service is different — it has to wait for *two* independent events (`payment.authorized` and `inventory.reserved`) for the *same order* before it's allowed to create a delivery. It tracks this with a small in-memory map keyed by `orderId`, and only proceeds once both flags are set (see `services/delivery-service/index.js`).

This is worth knowing about specifically because it's the most natural place to later inject a subtle bug — e.g. what happens if the service restarts mid-wait and loses that in-memory state, or if one of the two events is dropped.

## Why Postgres (and why one container, not five)

The original design diagram shows a separate Postgres instance per service, which is exactly what we're running now — each service connects to its own database (`orders`, `payments`, `inventory`, `delivery`, `notifications`), with its own schema, and none of them can see each other's tables. For local development they all live inside **one Postgres container** rather than five separate containers — same data isolation, far less resource overhead. If this ever needs to look more like production, each database can be split into its own container by changing one line per service (the `DATABASE_URL`/connection string) — no application code changes needed.

This is also what makes the RCA doc's worked example possible to reproduce later: that scenario is specifically about a Postgres connection pool exhausting under load, which only exists as a failure mode with a real Postgres server — SQLite has no connection pool to exhaust.

## Infrastructure

Three things run in Docker — `docker-compose.yml` defines:

- **Kafka** (`apache/kafka:3.7.0`, single broker, KRaft mode — no separate Zookeeper needed)
- **Redis** (used by Order Service to cache order status)
- **Postgres** (`postgres:16`, one server hosting all five service databases, created automatically on first boot via `docker/postgres-init/init-databases.sh`)

Every Node service itself runs as a plain local process (`node index.js`), not in a container. That split — infra in Docker, application code local — keeps iteration fast (edit a service, it restarts instantly) while still giving us a real broker and cache to reason about.
