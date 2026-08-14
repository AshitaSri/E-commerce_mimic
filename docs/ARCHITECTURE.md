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
Order Service  (:3001) ───────► orders.db (SQLite)
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
payments.db                inventory.db
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
            delivery.db
                 │
                 │ publishes: delivery.created
                 ▼
       Kafka topic: delivery.created
                 │
                 ▼
     Notification Service (:3005)
                 │
                 ▼
           notification.db
```

## The services

| Service | Port | Owns | Listens for | Publishes |
|---|---|---|---|---|
| API Gateway | 3000 | — | HTTP from client | — (forwards to Order Service) |
| Order Service | 3001 | `orders.db`, Redis | HTTP `POST /orders` | `order.created` |
| Payment Service | 3002 | `payments.db` | `order.created` | `payment.authorized` / `payment.failed` |
| Inventory Service | 3003 | `inventory.db` | `order.created` | `inventory.reserved` |
| Delivery Service | 3004 | `delivery.db` | `payment.authorized`, `payment.failed`, `inventory.reserved` | `delivery.created` |
| Notification Service | 3005 | `notification.db` | `delivery.created` | — |

Each service is a standalone Node/Express process with its own SQLite file — nothing shares a database. That isolation is deliberate: it mirrors how real microservices are usually built (each service owns its data), and it means an RCA engine investigating an incident has to trace *across* service boundaries, not just query one shared table.

## Why Kafka instead of direct HTTP calls between services

Order Service doesn't call Payment Service or Inventory Service directly. Instead it publishes one event, `order.created`, to Kafka, and both of those services independently pick it up. Kafka is the delivery mechanism in between — think of it as a shared bulletin board rather than a phone call.

This buys two things relevant to what we're building next:

1. **Fan-out for free** — one event, two independent consumers (Payment and Inventory), each reacting without knowing the other exists.
2. **A believable failure surface** — real production incidents often involve the message bus itself (a consumer falls behind, a message never gets picked up, a topic partition misbehaves). If we used plain HTTP calls instead, that whole category of bug wouldn't exist for the RCA engine to ever find.

## The one piece of real coordination logic: Delivery Service's join

Every other service reacts to a single event. Delivery Service is different — it has to wait for *two* independent events (`payment.authorized` and `inventory.reserved`) for the *same order* before it's allowed to create a delivery. It tracks this with a small in-memory map keyed by `orderId`, and only proceeds once both flags are set (see `services/delivery-service/index.js`).

This is worth knowing about specifically because it's the most natural place to later inject a subtle bug — e.g. what happens if the service restarts mid-wait and loses that in-memory state, or if one of the two events is dropped.

## Why SQLite instead of Postgres

The original design diagram shows a separate Postgres instance per service. For this first build we're using SQLite files instead — same "one database per service" principle, but zero setup (no Docker, no connection pooling to configure). It's a drop-in placeholder: when we get to testing failure modes that specifically involve database behavior (connection pool exhaustion, locking — the kind of thing the RCA doc's worked example is about), we'll swap the relevant service(s) over to real Postgres, since SQLite doesn't have a connection pool to exhaust.

## Infrastructure

Only two things run in Docker — `docker-compose.yml` defines:

- **Kafka** (`apache/kafka:3.7.0`, single broker, KRaft mode — no separate Zookeeper needed)
- **Redis** (used by Order Service to cache order status)

Every Node service itself runs as a plain local process (`node index.js`), not in a container. That split — infra in Docker, application code local — keeps iteration fast (edit a service, it restarts instantly) while still giving us a real broker and cache to reason about.
