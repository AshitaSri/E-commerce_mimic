const express = require('express');
const { randomUUID } = require('crypto');
const Redis = require('ioredis');
const { openDb, initProducer, publish } = require('shared');

const SERVICE_NAME = 'order-service';

const app = express();
app.use(express.json());

const db = openDb('orders.db', `
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TEXT NOT NULL
  );
`);

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.post('/orders', async (req, res) => {
  const { customer, items, total } = req.body;
  if (!customer || !items || total == null) {
    return res.status(400).json({ error: 'customer, items, and total are required' });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO orders (id, customer, items, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, customer, JSON.stringify(items), total, 'created', createdAt);

  await redis.set(`order:${id}:status`, 'created');

  await publish('order.created', { orderId: id, customer, items, total, createdAt });

  console.log(`[order-service] order ${id} created, published order.created`);
  res.status(201).json({ id, status: 'created' });
});

app.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json({ ...order, items: JSON.parse(order.items) });
});

const PORT = process.env.PORT || 3001;

initProducer(SERVICE_NAME).then(() => {
  app.listen(PORT, () => console.log(`[order-service] listening on ${PORT}`));
});
