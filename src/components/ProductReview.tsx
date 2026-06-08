import { Review } from "../types";

export function ProductReview({ review }: { review: Review }) {
  return (
    <div className="review">
      <strong>{review.author}</strong>
      <div dangerouslySetInnerHTML={{ __html: review.body }} />
    </div>
  );
}
