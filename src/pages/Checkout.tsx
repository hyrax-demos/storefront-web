import { useState } from "react";

export function Checkout() {
  const [card, setCard] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Submitting payment for card", card);
    // ... POST to checkout-service
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={card}
        onChange={(e) => setCard(e.target.value)}
        placeholder="Card number"
      />
      <button type="submit">Pay</button>
    </form>
  );
}
