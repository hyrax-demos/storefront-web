import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { submitReview } from "../client";

const input = { productId: "p-123", rating: 5, comment: "Loved it, great fit." };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("submitReview", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the review as JSON to /api/reviews and resolves with the body", async () => {
    const created = { id: "r-1", ...input };
    fetchMock.mockResolvedValueOnce(jsonResponse(201, created));

    await expect(submitReview(input)).resolves.toEqual(created);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/reviews");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      productId: "p-123",
      rating: 5,
      comment: "Loved it, great fit.",
    });
  });

  it("throws the server's JSON `error` message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "You already reviewed this product." }),
    );

    await expect(submitReview(input)).rejects.toThrow(
      "You already reviewed this product.",
    );
  });

  it("throws the server's JSON `message` field when `error` is absent", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { message: "Comment is too short." }),
    );

    await expect(submitReview(input)).rejects.toThrow("Comment is too short.");
  });

  it("throws the fallback message for a non-JSON error body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(submitReview(input)).rejects.toThrow(
      "Could not submit your review. Please try again.",
    );
  });

  it("throws the fallback message for a JSON body without error fields", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { ok: false }));

    await expect(submitReview(input)).rejects.toThrow(
      "Could not submit your review. Please try again.",
    );
  });

  it("rejects on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(submitReview(input)).rejects.toThrow("Failed to fetch");
  });
});
