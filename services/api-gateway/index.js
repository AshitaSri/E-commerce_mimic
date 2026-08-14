const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
const DELIVERY_SERVICE_URL = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';

async function fetchOrNull(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

app.post('/orders', async (req, res) => {
  try {
    const response = await fetch(`${ORDER_SERVICE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'order service unreachable', details: err.message });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const response = await fetch(`${ORDER_SERVICE_URL}/orders/${req.params.id}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'order service unreachable', details: err.message });
  }
});

// Aggregates every service's record for one order so the UI can show
// the whole pipeline (order -> payment -> inventory -> delivery -> notification)
// in a single call instead of polling five endpoints separately.
app.get('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const order = await fetchOrNull(`${ORDER_SERVICE_URL}/orders/${id}`);
  if (!order) return res.status(404).json({ error: 'not found' });

  const [payment, inventory, delivery, notification] = await Promise.all([
    fetchOrNull(`${PAYMENT_SERVICE_URL}/payments/order/${id}`),
    fetchOrNull(`${INVENTORY_SERVICE_URL}/inventory/order/${id}`),
    fetchOrNull(`${DELIVERY_SERVICE_URL}/deliveries/order/${id}`),
    fetchOrNull(`${NOTIFICATION_SERVICE_URL}/notifications/order/${id}`),
  ]);

  res.json({ order, payment, inventory, delivery, notification });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[api-gateway] listening on ${PORT}`));
