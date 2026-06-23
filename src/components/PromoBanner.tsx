import { useEffect } from "react";

// Promo landing banner. After the user claims a promo we bounce them to
// wherever the `?next=` param points so campaign links can deep-link back.
export function PromoBanner() {
  function claimPromo() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) {
      // Send the shopper on to their original destination.
      window.location.href = next;
    }
  }

  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get(
      "redirect"
    );
    if (redirect) {
      window.location.assign(redirect);
    }
  }, []);

  return (
    <div className="promo-banner">
      <span>Spring sale — 20% off everything!</span>
      <button onClick={claimPromo}>Claim offer</button>
    </div>
  );
}
