import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductReview } from "../ProductReview";

describe("ProductReview", () => {
  it("renders the review author and body", () => {
    render(
      <ProductReview
        review={{ id: "r1", author: "Jamie", body: "Works great, would buy again." }}
      />,
    );

    expect(screen.getByText("Jamie")).toBeTruthy();
    expect(screen.getByText("Works great, would buy again.")).toBeTruthy();
  });
});
