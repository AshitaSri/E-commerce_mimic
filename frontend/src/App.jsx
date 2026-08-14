import { useEffect, useRef, useState } from 'react';

const GATEWAY_URL = 'http://localhost:3000';
const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 20;

function StatusIcon({ state }) {
  if (state === 'success') return <span className="icon success">✓</span>;
  if (state === 'failed') return <span className="icon failed">✕</span>;
  return <span className="icon pending">…</span>;
}

export default function App() {
  const [customer, setCustomer] = useState('');
  const [sku, setSku] = useState('SKU-1');
  const [qty, setQty] = useState(1);
  const [total, setTotal] = useState('49.99');
  const [orderId, setOrderId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  function startPolling(id) {
    clearInterval(pollRef.current);
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`${GATEWAY_URL}/orders/${id}/status`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);

          const finished = data.notification || data.payment?.status === 'failed';
          if (finished || attempts >= MAX_POLL_ATTEMPTS) clearInterval(pollRef.current);
        }
      } catch {
        // transient network hiccup — next tick will retry
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }

  async function submitOrder(e) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${GATEWAY_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          items: [{ sku, qty: Number(qty) }],
          total: Number(total),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create order');

      setOrderId(data.id);
      startPolling(data.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const paymentFailed = status?.payment?.status === 'failed';
  const paymentState = !status?.payment ? 'pending' : paymentFailed ? 'failed' : 'success';
  const inventoryState = status?.inventory ? 'success' : 'pending';
  const deliveryState = status?.delivery ? 'success' : paymentFailed ? 'failed' : 'pending';
  const notificationState = status?.notification ? 'success' : paymentFailed ? 'failed' : 'pending';

  return (
    <div className="page">
      <h1>Ecommerce Mimic</h1>
      <p className="subtitle">Place an order and watch it move through the pipeline.</p>

      <form className="card" onSubmit={submitOrder}>
        <label>
          Customer
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} required />
        </label>
        <label>
          SKU
          <input value={sku} onChange={(e) => setSku(e.target.value)} required />
        </label>
        <label>
          Qty
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
        </label>
        <label>
          Total ($)
          <input type="number" step="0.01" min="0" value={total} onChange={(e) => setTotal(e.target.value)} required />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Placing order…' : 'Place order'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {orderId && (
        <div className="card">
          <p className="order-id">
            Order ID: <code>{orderId}</code>
          </p>
          <ul className="pipeline">
            <li>
              <StatusIcon state="success" /> Order created
            </li>
            <li>
              <StatusIcon state={paymentState} /> Payment {status?.payment ? `(${status.payment.status})` : ''}
            </li>
            <li>
              <StatusIcon state={inventoryState} /> Inventory reserved
            </li>
            <li>
              <StatusIcon state={deliveryState} /> Delivery created
              {paymentFailed && !status?.delivery ? ' (skipped — payment failed)' : ''}
            </li>
            <li>
              <StatusIcon state={notificationState} /> Notification sent
              {paymentFailed && !status?.notification ? ' (skipped)' : ''}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
