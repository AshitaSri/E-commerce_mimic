const express = require('express');
const { randomUUID } = require('crypto');
const { openDb, consume } = require('shared');

const SERVICE_NAME = 'notification-service';

const app = express();

const db = openDb('notification.db', `
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

async function handleDeliveryCreated(topic, event) {
  const { orderId } = event;
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const message = `Your order ${orderId} is out for delivery!`;

  db.prepare(
    'INSERT INTO notifications (id, order_id, message, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, orderId, message, createdAt);

  console.log(`[notification-service] sent: "${message}"`);
}

const PORT = process.env.PORT || 3005;

(async () => {
  await consume(SERVICE_NAME, ['delivery.created'], 'notification-service-group', handleDeliveryCreated);
  app.listen(PORT, () => console.log(`[notification-service] listening on ${PORT}`));
})();
