const express = require('express');
const { randomUUID } = require('crypto');
const { openDb, initProducer, publish, consume } = require('shared');

const SERVICE_NAME = 'payment-service';

const app = express();

const db = openDb('payments.db', `
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// stand-in for a real payment gateway: ~10% of charges are declined
function mockChargeCard(amount) {
  const declined = Math.random() < 0.1;
  return { approved: !declined };
}

async function handleOrderCreated(topic, event) {
  const { orderId, total } = event;
  const { approved } = mockChargeCard(total);
  const id = randomUUID();
  const status = approved ? 'authorized' : 'failed';
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO payments (id, order_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, orderId, total, status, createdAt);

  await publish(approved ? 'payment.authorized' : 'payment.failed', {
    paymentId: id,
    orderId,
    amount: total,
    status,
    createdAt,
  });

  console.log(`[payment-service] order ${orderId} payment ${status}`);
}

const PORT = process.env.PORT || 3002;

(async () => {
  await initProducer(SERVICE_NAME);
  await consume(SERVICE_NAME, ['order.created'], 'payment-service-group', handleOrderCreated);
  app.listen(PORT, () => console.log(`[payment-service] listening on ${PORT}`));
})();
