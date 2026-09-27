import { useId, useState } from "react";
import type { FormEvent } from "react";
import type { Review } from "../types";
import { submitReview } from "../api/client";
import {
  COMMENT_MAX_LENGTH,
  validateReview,
  type ReviewErrors,
} from "./reviewValidation";

const RATINGS = [1, 2, 3, 4, 5] as const;

const SUBMIT_FALLBACK_ERROR = "Could not submit your review. Please try again.";
const SUBMIT_SUCCESS_MESSAGE = "Thanks! Your review has been submitted.";

export function ProductReview({
  review,
  productId,
}: {
  review: Review;
  productId: string;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const baseId = useId();
  const commentId = `${baseId}-comment`;
  const commentErrorId = `${baseId}-comment-error`;
  const commentCountId = `${baseId}-comment-count`;
  const ratingErrorId = `${baseId}-rating-error`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSuccessMessage(null);
    setServerError(null);

    const validationErrors = validateReview({ rating, comment });
    if (validationErrors.rating || validationErrors.comment) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await submitReview({
        productId,
        // validateReview guarantees a 1-5 integer here.
        rating: rating as number,
        comment: comment.trim(),
      });
      setSuccessMessage(SUBMIT_SUCCESS_MESSAGE);
      setRating(null);
      setComment("");
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : SUBMIT_FALLBACK_ERROR;
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="review">
      <strong>{review.author}</strong>
      <p>{review.body}</p>

      <form className="review-form" onSubmit={handleSubmit} noValidate>
        <fieldset
          className="review-form__rating"
          aria-describedby={errors.rating ? ratingErrorId : undefined}
        >
          <legend>Rating</legend>
          {RATINGS.map((value) => (
            <label key={value} className="review-form__star">
              <input
                type="radio"
                name={`${baseId}-rating`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
              />
              {value === 1 ? "1 star" : `${value} stars`}
            </label>
          ))}
          {errors.rating && (
            <p id={ratingErrorId} className="review-form__error" role="alert">
              {errors.rating}
            </p>
          )}
        </fieldset>

        <div className="review-form__comment">
          <label htmlFor={commentId}>Comment</label>
          <textarea
            id={commentId}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            aria-invalid={errors.comment ? true : undefined}
            aria-describedby={
              errors.comment
                ? `${commentCountId} ${commentErrorId}`
                : commentCountId
            }
          />
          <span id={commentCountId} className="review-form__count">
            {comment.trim().length}/{COMMENT_MAX_LENGTH}
          </span>
          {errors.comment && (
            <p id={commentErrorId} className="review-form__error" role="alert">
              {errors.comment}
            </p>
          )}
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit review"}
        </button>

        {successMessage && (
          <p className="review-form__success" role="status">
            {successMessage}
          </p>
        )}
        {serverError && (
          <p className="review-form__error" role="alert">
            {serverError}
          </p>
        )}
      </form>
    </div>
  );
}
