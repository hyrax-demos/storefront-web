import { Checkout } from "./pages/Checkout";
import { PromoBanner, PriceTag } from "./components/PromoBanner";
import { ProductReview } from "./components/ProductReview";
import { SearchBox } from "./components/SearchBox";
import { CartBadge } from "./components/CartBadge";
import { CartProvider } from "./context/CartContext";
import type { PromoRule } from "./utils/promo";

const DEMO_PROMO: PromoRule = { minSubtotal: 25, percentOff: 10 };

export function App() {
  return (
    <CartProvider>
      <div>
        <header>
          <h1>Hyrax Labs Storefront</h1>
          <CartBadge />
        </header>
        <PromoBanner />
        <PriceTag basePriceUsd={19.99} />
        <SearchBox />
        <ProductReview
          review={{ id: "1", author: "Anon", body: "Great product!" }}
        />
        <Checkout promo={DEMO_PROMO} />
      </div>
    </CartProvider>
  );
}
