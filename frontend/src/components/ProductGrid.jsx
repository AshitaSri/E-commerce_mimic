import ProductCard from './ProductCard.jsx';
import { PRODUCTS } from '../data/products.js';

export default function ProductGrid({ onBuy }) {
  return (
    <div className="product-grid">
      {PRODUCTS.map((product) => (
        <ProductCard key={product.id} product={product} onBuy={onBuy} />
      ))}
    </div>
  );
}
