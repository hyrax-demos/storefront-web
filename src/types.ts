export interface Product {
  id: string;
  name: string;
  priceCents: number;
  description: string;
}

export interface Review {
  id: string;
  author: string;
  body: string;
}

export interface SearchHit {
  productId: string;
  title: string;
  url: string;
  // Unit price in dollars.
  unitPrice: number;
}
