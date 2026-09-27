import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CartContext";
import { cartSubtotal } from "../utils/cart";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Header mini-cart: a badge with the total item count that toggles a
// dropdown of lines (with remove buttons) and the subtotal. The dropdown
// closes on a click outside the component or on Escape.
export function CartBadge() {
  const { lines, removeItem } = useCart();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      const target = event.target;
      if (root && target instanceof Node && !root.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="cart-badge" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
        onClick={() => setOpen((o) => !o)}
      >
        Cart <span data-testid="cart-badge-count">{count}</span>
      </button>
      {open && (
        <div
          className="cart-badge__dropdown"
          role="dialog"
          aria-label="Mini cart"
          data-testid="mini-cart"
        >
          {lines.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            <>
              <ul>
                {lines.map((line) => (
                  <li key={line.productId}>
                    <span>
                      {line.name} × {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => removeItem(line.productId)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p>
                Subtotal:{" "}
                <span data-testid="mini-cart-subtotal">
                  {usd.format(cartSubtotal(lines))}
                </span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
