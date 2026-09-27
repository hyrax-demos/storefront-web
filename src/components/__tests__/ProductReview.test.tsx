import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { ProductReview } from "../ProductReview";
import { submitReview } from "../../api/client";

vi.mock("../../api/client", () => ({
  submitReview: vi.fn(),
}));

const submitReviewMock = vi.mocked(submitReview);

const PRODUCT_ID = "p-100";
const REVIEW = { id: "r1", author: "Jamie", body: "Works great, would buy again." };

function renderForm() {
  return render(<ProductReview productId={PRODUCT_ID} review={REVIEW} />);
}

function commentField(): HTMLTextAreaElement {
  return screen.getByLabelText("Comment") as HTMLTextAreaElement;
}

function starInput(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function typeComment(value: string) {
  fireEvent.change(commentField(), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
}

beforeEach(() => {
  submitReviewMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ProductReview", () => {
  it("renders the review author and body", () => {
    renderForm();

    expect(screen.getByText("Jamie")).toBeTruthy();
    expect(screen.getByText("Works great, would buy again.")).toBeTruthy();
  });

  describe("validation", () => {
    it("shows rating and comment errors when submitted empty", async () => {
      renderForm();

      submit();

      const alerts = await screen.findAllByRole("alert");
      const texts = alerts.map((el) => el.textContent);
      expect(texts).toContain("Please select a rating from 1 to 5 stars.");
      expect(texts).toContain("Comment is required.");
      expect(submitReviewMock).not.toHaveBeenCalled();
    });

    it("shows the min-length error for a 5-character comment", async () => {
      renderForm();
      fireEvent.click(starInput("4 stars"));
      typeComment("short");

      submit();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("Comment must be at least 10 characters.");
      expect(submitReviewMock).not.toHaveBeenCalled();
    });

    it("shows the max-length error for a 501-character comment", async () => {
      renderForm();
      fireEvent.click(starInput("4 stars"));
      typeComment("a".repeat(501));

      submit();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("Comment must be at most 500 characters.");
      expect(submitReviewMock).not.toHaveBeenCalled();
    });
  });

  describe("character counter", () => {
    function counter(): HTMLElement {
      return screen.getByTestId("comment-count");
    }

    it("updates live as the comment is typed", () => {
      renderForm();

      expect(counter().textContent).toBe("0/500");

      typeComment("Nice shoes");
      expect(counter().textContent).toBe("10/500");

      typeComment("Nice shoes, fit well");
      expect(counter().textContent).toBe("20/500");
    });

    it("is not red at exactly 500 characters", () => {
      renderForm();

      typeComment("a".repeat(500));

      expect(counter().textContent).toBe("500/500");
      expect(counter().style.color).toBe("");
      expect(counter().classList.contains("review-form__count--over")).toBe(
        false,
      );
    });

    it("turns red past 500 characters and back when shortened", () => {
      renderForm();

      typeComment("a".repeat(501));

      expect(counter().textContent).toBe("501/500");
      expect(counter().style.color).toBe("red");
      expect(counter().classList.contains("review-form__count--over")).toBe(
        true,
      );

      typeComment("a".repeat(499));
      expect(counter().textContent).toBe("499/500");
      expect(counter().style.color).toBe("");
    });
  });

  it("submits the trimmed review, shows success and resets the fields", async () => {
    submitReviewMock.mockResolvedValue({ id: "new-review" });
    renderForm();

    fireEvent.click(starInput("4 stars"));
    typeComment("   Really solid product.   ");
    submit();

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("Thanks! Your review has been submitted.");
    expect(submitReviewMock).toHaveBeenCalledTimes(1);
    expect(submitReviewMock).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      rating: 4,
      comment: "Really solid product.",
    });
    expect(commentField().value).toBe("");
    for (const label of ["1 star", "2 stars", "3 stars", "4 stars", "5 stars"]) {
      expect(starInput(label).checked).toBe(false);
    }
  });

  it("shows the server error and keeps the typed comment", async () => {
    submitReviewMock.mockRejectedValue(new Error("Review already exists"));
    renderForm();

    fireEvent.click(starInput("5 stars"));
    typeComment("I already reviewed this one.");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Review already exists");
    expect(submitReviewMock).toHaveBeenCalledTimes(1);
    expect(commentField().value).toBe("I already reviewed this one.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("disables the submit button while the request is pending", async () => {
    let resolveSubmit: (value: unknown) => void = () => {};
    submitReviewMock.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderForm();

    fireEvent.click(starInput("3 stars"));
    typeComment("Decent value for the price.");
    submit();

    const pendingButton = (await screen.findByRole("button", {
      name: "Submitting…",
    })) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    expect(submitReviewMock).toHaveBeenCalledTimes(1);

    resolveSubmit(null);

    const idleButton = (await screen.findByRole("button", {
      name: "Submit review",
    })) as HTMLButtonElement;
    await waitFor(() => expect(idleButton.disabled).toBe(false));
    expect(await screen.findByRole("status")).toBeTruthy();
  });
});
