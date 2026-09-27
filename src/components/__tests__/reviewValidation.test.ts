import { describe, it, expect } from "vitest";
import { validateReview } from "../reviewValidation";

const validComment = "Great product, works well.";

describe("validateReview", () => {
  it("returns {} for valid input", () => {
    expect(validateReview({ rating: 4, comment: validComment })).toEqual({});
  });

  it("flags a missing rating", () => {
    expect(validateReview({ rating: null, comment: validComment })).toEqual({
      rating: "Please select a rating from 1 to 5 stars.",
    });
  });

  it.each([0, 6, -1, 2.5, Number.NaN])("flags out-of-range rating %s", (rating) => {
    expect(validateReview({ rating, comment: validComment }).rating).toBe(
      "Please select a rating from 1 to 5 stars.",
    );
  });

  it("accepts ratings 1 and 5", () => {
    expect(validateReview({ rating: 1, comment: validComment })).toEqual({});
    expect(validateReview({ rating: 5, comment: validComment })).toEqual({});
  });

  it.each(["", "   \n\t  "])("requires a comment (%j)", (comment) => {
    expect(validateReview({ rating: 3, comment }).comment).toBe(
      "Comment is required.",
    );
  });

  it("rejects a 9-character comment", () => {
    expect(validateReview({ rating: 3, comment: "a".repeat(9) }).comment).toBe(
      "Comment must be at least 10 characters.",
    );
  });

  it("accepts a 10-character comment", () => {
    expect(validateReview({ rating: 3, comment: "a".repeat(10) })).toEqual({});
  });

  it("accepts a 500-character comment", () => {
    expect(validateReview({ rating: 3, comment: "a".repeat(500) })).toEqual({});
  });

  it("rejects a 501-character comment", () => {
    expect(validateReview({ rating: 3, comment: "a".repeat(501) }).comment).toBe(
      "Comment must be at most 500 characters.",
    );
  });

  it("trims the comment before checking length", () => {
    expect(
      validateReview({ rating: 3, comment: `  ${"a".repeat(9)}  ` }).comment,
    ).toBe("Comment must be at least 10 characters.");
    expect(
      validateReview({ rating: 3, comment: `  ${"a".repeat(500)}  ` }),
    ).toEqual({});
  });

  it("reports both errors together", () => {
    expect(validateReview({ rating: null, comment: "" })).toEqual({
      rating: "Please select a rating from 1 to 5 stars.",
      comment: "Comment is required.",
    });
  });
});
