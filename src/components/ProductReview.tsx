import type { Review } from "../types";

export function ProductReview({ review }: { review: Review }) {
  return (
    <div className="review">
      <strong>{review.author}</strong>
      <p>{review.body}</p>
    </div>
  );
}
