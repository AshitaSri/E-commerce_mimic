# Running & testing this project

## 1. Start infrastructure (Kafka + Redis + Postgres)

```bash
docker compose up -d
```

Check all three containers are actually up:

```bash
docker compose ps
```

You should see `kafka`, `redis`, and `postgres` all `Up`. Postgres automatically creates the 5 per-service databases (`orders`, `payments`, `inventory`, `delivery`, `notifications`) the first time its container starts, using `docker/postgres-init/init-databases.sh` — nothing to run manually there.

**First time only** — Kafka needs its topics created before any service can subscribe to them:

```bash
for t in order.created payment.authorized payment.failed inventory.reserved delivery.created; do
  docker exec ecommerce_mimic-kafka-1 /opt/kafka/bin/kafka-topics.sh \
    --create --if-not-exists --topic "$t" \
    --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
done
```

(If you ever wipe the Kafka container/volume — e.g. `docker compose down -v` — you'll need to re-run this. Same goes for Postgres: `down -v` wipes the databases too, and they'll be recreated fresh on next `up -d`.)

## 2. Install dependencies

```bash
npm install
```

This installs everything for all six services in one go (npm workspaces).

## 3. Start all services

```bash
npm run dev
```

This runs all six services together in one terminal, each line prefixed with its service name (`[gateway]`, `[order]`, `[payment]`, `[inventory]`, `[delivery]`, `[notification]`) so you can watch the whole pipeline react in real time. Leave this running — open a second terminal for the next steps.

Give it ~10-15 seconds on first boot — Kafka's internal coordinator takes a moment to become available, and you may briefly see "group coordinator is not available" errors in the logs. That's expected and resolves itself; the services retry automatically.

## 4. Place an order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":"ashita","items":[{"sku":"SKU-1","qty":2}],"total":49.99}'
```

Response:

```json
{"id":"<order-id>","status":"created"}
```

Watch the `npm run dev` terminal — within a second or two you should see all five services react in order:

```
[order] order <id> created, published order.created
[inventory] order <id> inventory reserved
[payment] order <id> payment authorized
[delivery] order <id> delivery created
[notification] sent: "Your order <id> is out for delivery!"
```

(Payment and Inventory can appear in either order — they run in parallel, both reacting to the same `order.created` event.)

## 5. Check the result

Fetch the order back through the gateway:

```bash
curl http://localhost:3000/orders/<order-id>
```

Or look directly at what each service persisted — every service has its own Postgres database:

```bash
docker exec ecommerce_mimic-postgres-1 psql -U app -d orders -c "SELECT * FROM orders;"
docker exec ecommerce_mimic-postgres-1 psql -U app -d payments -c "SELECT * FROM payments;"
docker exec ecommerce_mimic-postgres-1 psql -U app -d inventory -c "SELECT * FROM reservations;"
docker exec ecommerce_mimic-postgres-1 psql -U app -d delivery -c "SELECT * FROM deliveries;"
docker exec ecommerce_mimic-postgres-1 psql -U app -d notifications -c "SELECT * FROM notifications;"
```

All five rows should share the same `order_id` — that's the trail an RCA engine would later walk backwards through.

You can also check the Redis cache Order Service wrote:

```bash
docker exec ecommerce_mimic-redis-1 redis-cli GET "order:<order-id>:status"
```

## 6. Testing the "unhappy path"

Payment Service randomly declines about 10% of charges (`mockChargeCard` in `services/payment-service/index.js`) to simulate a real payment gateway. When that happens:

- `payments` DB gets a row with `status = 'failed'`
- Payment Service publishes `payment.failed` instead of `payment.authorized`
- Delivery Service sees `payment.failed` and **does not** create a delivery — you'll see `payment failed, skipping delivery` in the logs, and no row appears in the `delivery` or `notifications` databases for that order

Since it's random, just place a handful of orders in a row and watch for one to decline:

```bash
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d "{\"customer\":\"test-$i\",\"items\":[{\"sku\":\"SKU-1\",\"qty\":1}],\"total\":10.00}"
  echo
done
```

## 7. Stopping everything

Stop the services: `Ctrl+C` in the `npm run dev` terminal.

Stop the infrastructure:

```bash
docker compose down          # stops Kafka + Redis + Postgres, keeps their data
docker compose down -v       # also wipes all data — you'll need to recreate Kafka topics (step 1) next time; Postgres databases recreate themselves automatically
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| A service crashes immediately with `UNKNOWN_TOPIC_OR_PARTITION` | Kafka topics weren't created yet — run the topic-creation loop in step 1. |
| Services print repeated `group coordinator is not available` and never recover | Kafka's internal offsets topic needs `replication factor 1` for a single-broker setup — already configured in `docker-compose.yml`; if you edited that file, make sure those three `KAFKA_*REPLICATION_FACTOR*` lines are still there. |
| `docker compose up -d` fails with "Cannot connect to the Docker daemon" | Docker Desktop isn't running — open it, wait for the whale icon to settle, then retry. |
| A service errors with `ECONNREFUSED` on port 5432 | Postgres isn't up yet or the container isn't running — check `docker compose ps`. |
| Containers show `Exited` after your Mac slept or Docker restarted | They don't auto-restart by default — just run `docker compose up -d` again; your data is preserved. |
| An order never reaches Delivery/Notification | Check if it was one of the ~10% declined payments (step 6) — that's expected behavior, not a bug. |
