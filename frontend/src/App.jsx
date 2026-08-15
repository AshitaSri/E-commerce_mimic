import { useState } from 'react';
import ProductGrid from './components/ProductGrid.jsx';
import Checkout from './components/Checkout.jsx';
import OrderStatus from './components/OrderStatus.jsx';
import { GATEWAY_URL } from './config.js';

export default function App() {
  const [view, setView] = useState('catalog'); // catalog | checkout | status
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleBuy(product) {
    setSelectedProduct(product);
    setError(null);
    setView('checkout');
  }

  async function handleSubmitOrder(payload) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${GATEWAY_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to place order');

      setOrderId(data.id);
      setView('status');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function backToShopping() {
    setView('catalog');
    setSelectedProduct(null);
    setOrderId(null);
    setError(null);
  }

  return (
    <div className="app">
      <header className="navbar">
        <span className="brand">
          Mimic<span className="brand-accent">Mart</span>
        </span>
        <nav className="nav-links">
          <span>MEN</span>
          <span>WOMEN</span>
          <span>KIDS</span>
          <span>HOME &amp; LIVING</span>
        </nav>
      </header>

      <main className="page">
        {view === 'catalog' && <ProductGrid onBuy={handleBuy} />}
        {view === 'checkout' && selectedProduct && (
          <Checkout
            product={selectedProduct}
            onSubmit={handleSubmitOrder}
            onBack={backToShopping}
            submitting={submitting}
            error={error}
          />
        )}
        {view === 'status' && orderId && (
          <OrderStatus orderId={orderId} onBackToShopping={backToShopping} />
        )}
      </main>
    </div>
  );
}
