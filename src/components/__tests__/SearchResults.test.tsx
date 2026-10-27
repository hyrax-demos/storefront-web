import { describe, it, expect, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { SearchResults } from "../SearchResults";
import type { SearchHit } from "../../types";

afterEach(() => {
  cleanup();
});

const HITS: SearchHit[] = [
  { productId: "p-1", title: "Cheap Mug", url: "/p/1", unitPrice: 5 },
  { productId: "p-2", title: "Mid Lamp", url: "/p/2", unitPrice: 40 },
  { productId: "p-3", title: "Pricey Chair", url: "/p/3", unitPrice: 200 },
];

function titlesInOrder(): string[] {
  return screen
    .getAllByRole("link")
    .map((el) => el.textContent ?? "");
}

describe("SearchResults", () => {
  it("renders every hit with its title and formatted price", () => {
    render(<SearchResults results={HITS} />);

    expect(screen.getByText("Cheap Mug")).toBeTruthy();
    expect(screen.getByText("Mid Lamp")).toBeTruthy();
    expect(screen.getByText("Pricey Chair")).toBeTruthy();
    expect(screen.getByText("$5.00")).toBeTruthy();
    expect(screen.getByText("$200.00")).toBeTruthy();
  });

  it("re-sorts ascending and descending by price without changing the hit set", () => {
    render(<SearchResults results={HITS} />);

    const select = screen.getByRole("combobox");

    fireEvent.change(select, { target: { value: "priceAsc" } });
    expect(titlesInOrder()).toEqual(["Cheap Mug", "Mid Lamp", "Pricey Chair"]);

    fireEvent.change(select, { target: { value: "priceDesc" } });
    expect(titlesInOrder()).toEqual(["Pricey Chair", "Mid Lamp", "Cheap Mug"]);
  });

  // Saves the first row in relevance order (Cheap Mug), then switches to the
  // high-to-low price sort, which moves Cheap Mug from the first row to the last.
  it("keeps the saved state on the saved product after re-sorting", () => {
    render(<SearchResults results={HITS} />);

    const mugRow = screen
      .getAllByRole("listitem")
      .find((li) => within(li).getByRole("link").textContent === "Cheap Mug");
    if (!mugRow) throw new Error("no row for Cheap Mug");
    fireEvent.click(within(mugRow).getByRole("button"));

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "priceDesc" },
    });

    const buttonTextByTitle: Record<string, string> = {};
    for (const li of screen.getAllByRole("listitem")) {
      const title = within(li).getByRole("link").textContent ?? "";
      buttonTextByTitle[title] = within(li).getByRole("button").textContent ?? "";
    }

    expect(buttonTextByTitle).toEqual({
      "Pricey Chair": "Save for later",
      "Mid Lamp": "Save for later",
      "Cheap Mug": "Saved",
    });
    expect(titlesInOrder()).toEqual(["Pricey Chair", "Mid Lamp", "Cheap Mug"]);
  });
});
