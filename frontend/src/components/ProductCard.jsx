export default function ProductCard({ product, onBuy }) {
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);

  return (
    <div className="product-card">
      <div className="product-image" style={{ background: product.color }}>
        <span className="product-emoji">{product.emoji}</span>
      </div>
      <div className="product-info">
        <p className="product-brand">{product.brand}</p>
        <p className="product-name">{product.name}</p>
        <div className="product-price-row">
          <span className="product-price">₹{product.price}</span>
          <span className="product-mrp">₹{product.mrp}</span>
          <span className="product-discount">{discount}% OFF</span>
        </div>
        <button className="buy-btn" onClick={() => onBuy(product)}>
          BUY NOW
        </button>
      </div>
    </div>
  );
}
