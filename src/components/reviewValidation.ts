export interface ReviewValues {
  rating: number | null;
  comment: string;
}

export interface ReviewErrors {
  rating?: string;
  comment?: string;
}

export const COMMENT_MIN_LENGTH = 10;
export const COMMENT_MAX_LENGTH = 500;

export function validateReview(values: ReviewValues): ReviewErrors {
  const errors: ReviewErrors = {};
  const { rating } = values;

  if (
    rating === null ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    errors.rating = "Please select a rating from 1 to 5 stars.";
  }

  const comment = values.comment.trim();
  if (comment.length === 0) {
    errors.comment = "Comment is required.";
  } else if (comment.length < COMMENT_MIN_LENGTH) {
    errors.comment = "Comment must be at least 10 characters.";
  } else if (comment.length > COMMENT_MAX_LENGTH) {
    errors.comment = "Comment must be at most 500 characters.";
  }

  return errors;
}
