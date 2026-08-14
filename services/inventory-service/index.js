require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('newrelic');

const express = require('express');
const { randomUUID } = require('crypto');
const { openDb, initProducer, publish, consume } = require('shared');

const SERVICE_NAME = 'inventory-service';

const app = express();

let db;

async function handleOrderCreated(topic, event) {
  const { orderId, items } = event;
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await db.query(
    'INSERT INTO reservations (id, order_id, items, status, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, orderId, JSON.stringify(items), 'reserved', createdAt]
  );

  await publish('inventory.reserved', { reservationId: id, orderId, items, createdAt });

  console.log(`[inventory-service] order ${orderId} inventory reserved`);
}

app.get('/inventory/order/:orderId', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM reservations WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.params.orderId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

const PORT = process.env.PORT || 3003;

(async () => {
  db = await openDb('inventory', `
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      items TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await initProducer(SERVICE_NAME);
  await consume(SERVICE_NAME, ['order.created'], 'inventory-service-group', handleOrderCreated);
  app.listen(PORT, () => console.log(`[inventory-service] listening on ${PORT}`));
})();
