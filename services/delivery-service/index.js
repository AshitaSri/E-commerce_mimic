const express = require('express');
const { randomUUID } = require('crypto');
const { openDb, initProducer, publish, consume } = require('shared');

const SERVICE_NAME = 'delivery-service';

const app = express();

let db;

// Delivery only fires once BOTH payment.authorized and inventory.reserved
// have arrived for the same orderId. This in-memory map is the join state.
const pending = new Map();

async function tryCreateDelivery(orderId) {
  const state = pending.get(orderId);
  if (!state || !state.paymentAuthorized || !state.inventoryReserved) return;

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await db.query(
    'INSERT INTO deliveries (id, order_id, status, created_at) VALUES ($1, $2, $3, $4)',
    [id, orderId, 'created', createdAt]
  );

  await publish('delivery.created', { deliveryId: id, orderId, createdAt });

  console.log(`[delivery-service] order ${orderId} delivery created`);
  pending.delete(orderId);
}

async function handleEvent(topic, event) {
  const { orderId } = event;

  if (topic === 'payment.failed') {
    console.log(`[delivery-service] order ${orderId} payment failed, skipping delivery`);
    pending.delete(orderId);
    return;
  }

  const state = pending.get(orderId) || {};
  if (topic === 'payment.authorized') state.paymentAuthorized = true;
  if (topic === 'inventory.reserved') state.inventoryReserved = true;
  pending.set(orderId, state);

  await tryCreateDelivery(orderId);
}

const PORT = process.env.PORT || 3004;

(async () => {
  db = await openDb('delivery', `
    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await initProducer(SERVICE_NAME);
  await consume(
    SERVICE_NAME,
    ['payment.authorized', 'payment.failed', 'inventory.reserved'],
    'delivery-service-group',
    handleEvent
  );
  app.listen(PORT, () => console.log(`[delivery-service] listening on ${PORT}`));
})();
