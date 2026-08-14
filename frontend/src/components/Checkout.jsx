import { useState } from 'react';

export default function Checkout({ product, onSubmit, onBack, submitting, error }) {
  const [customer, setCustomer] = useState('');
  const [qty, setQty] = useState(1);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      customer,
      items: [{ sku: product.sku, qty: Number(qty) }],
      total: Number((product.price * qty).toFixed(2)),
    });
  }

  return (
    <div className="checkout">
      <button className="back-link" onClick={onBack}>
        ← Back to shopping
      </button>
      <div className="checkout-card">
        <div className="checkout-product">
          <div className="product-image small" style={{ background: product.color }}>
            <span className="product-emoji">{product.emoji}</span>
          </div>
          <div>
            <p className="product-brand">{product.brand}</p>
            <p className="product-name">{product.name}</p>
            <p className="product-price">₹{product.price}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Your name
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} required />
          </label>
          <label>
            Quantity
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </label>
          <p className="checkout-total">Total: ₹{(product.price * qty).toFixed(2)}</p>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="buy-btn wide" disabled={submitting}>
            {submitting ? 'Placing order…' : 'Place order'}
          </button>
        </form>
      </div>
    </div>
  );
}
