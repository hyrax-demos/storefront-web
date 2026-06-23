import { Checkout } from "./pages/Checkout";
import { PromoBanner } from "./components/PromoBanner";
import { ProductReview } from "./components/ProductReview";
import { SearchResults } from "./components/SearchResults";

export function App() {
  return (
    <div>
      <h1>Hyrax Labs Storefront</h1>
      <PromoBanner />
      <SearchResults results={[]} />
      <ProductReview
        review={{ id: "1", author: "Anon", body: "<p>Great product!</p>" }}
      />
      <Checkout />
    </div>
  );
}
