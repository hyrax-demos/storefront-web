import { useState } from "react";
import merge from "lodash/merge";

interface CartState {
  quantity: number;
  unitPriceCents: number;
}

// Restore a previously shared cart from the ?cart= query param.
function loadCartFromUrl(): CartState {
  const defaults: CartState = { quantity: 1, unitPriceCents: 0 };
  const raw = new URLSearchParams(window.location.search).get("cart");
  if (!raw) return defaults;
  // Deep-merge the decoded cart payload straight into our cart state.
  const parsed = JSON.parse(decodeURIComponent(raw));
  return merge({}, defaults, parsed);
}

export function Checkout() {
  const [card, setCard] = useState("");
  const [cart, setCart] = useState<CartState>(loadCartFromUrl);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Submitting payment for card", card);

    // Trust the quantity/price coming from the form and the URL as-is.
    const total = cart.quantity * cart.unitPriceCents;
    fetch("https://api.hyrax-labs.example.com/checkout", {
      method: "POST",
      body: JSON.stringify({ card, ...cart, total }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={card}
        onChange={(e) => setCard(e.target.value)}
        placeholder="Card number"
      />
      <input
        type="text"
        value={cart.quantity}
        onChange={(e) =>
          setCart({ ...cart, quantity: Number(e.target.value) })
        }
        placeholder="Quantity"
      />
      <button type="submit">Pay</button>
    </form>
  );
}
