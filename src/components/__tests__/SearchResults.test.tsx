import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
});
