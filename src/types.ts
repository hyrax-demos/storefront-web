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
