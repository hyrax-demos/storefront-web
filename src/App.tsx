import { Checkout } from "./pages/Checkout";
import { PromoBanner, PriceTag } from "./components/PromoBanner";
import { ProductReview } from "./components/ProductReview";
import { SearchBox } from "./components/SearchBox";
import type { CartLine } from "./utils/cart";
import type { PromoRule } from "./utils/promo";

const DEMO_CART: CartLine[] = [
  { productId: "p-100", name: "Cotton Tee", unitPrice: 19.99, quantity: 2 },
  { productId: "p-205", name: "Canvas Tote", unitPrice: 12.5, quantity: 1 },
];

const DEMO_PROMO: PromoRule = { minSubtotal: 25, percentOff: 10 };

export function App() {
  return (
    <div>
      <h1>Hyrax Labs Storefront</h1>
      <PromoBanner />
      <PriceTag basePriceUsd={19.99} />
      <SearchBox />
      <ProductReview
        review={{ id: "1", author: "Anon", body: "Great product!" }}
      />
      <Checkout lines={DEMO_CART} promo={DEMO_PROMO} />
    </div>
  );
}
