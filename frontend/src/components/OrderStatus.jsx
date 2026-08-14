import { useEffect, useRef, useState } from 'react';

const GATEWAY_URL = 'http://localhost:3000';
const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 20;

function StatusIcon({ state }) {
  if (state === 'success') return <span className="icon success">✓</span>;
  if (state === 'failed') return <span className="icon failed">✕</span>;
  return <span className="icon pending">…</span>;
}

export default function OrderStatus({ orderId, onBackToShopping }) {
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    clearInterval(pollRef.current);
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`${GATEWAY_URL}/orders/${orderId}/status`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);

          const finished = data.notification || data.payment?.status === 'failed';
          if (finished || attempts >= MAX_POLL_ATTEMPTS) clearInterval(pollRef.current);
        }
      } catch {
        // transient network hiccup — next tick retries
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [orderId]);

  const paymentFailed = status?.payment?.status === 'failed';
  const paymentState = !status?.payment ? 'pending' : paymentFailed ? 'failed' : 'success';
  const inventoryState = status?.inventory ? 'success' : 'pending';
  const deliveryState = status?.delivery ? 'success' : paymentFailed ? 'failed' : 'pending';
  const notificationState = status?.notification ? 'success' : paymentFailed ? 'failed' : 'pending';

  return (
    <div className="checkout">
      <button className="back-link" onClick={onBackToShopping}>
        ← Back to shopping
      </button>
      <div className="card">
        <p className="order-id">
          Order ID: <code>{orderId}</code>
        </p>
        <ul className="pipeline">
          <li>
            <StatusIcon state="success" /> Order placed
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
    </div>
  );
}
