# storefront-web

Customer-facing storefront for Hyrax Labs. React + Vite single-page app that
talks to `checkout-service` and `inventory-api`.

## Stack

- React 18 + TypeScript
- Vite

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Runs on `http://localhost:5173`.

## Project Structure

```
storefront-web/
├── index.html          # HTML entry point (Vite template)
├── package.json        # Dependencies and npm scripts
├── tsconfig.json       # TypeScript compiler configuration
├── vite.config.ts      # Vite bundler configuration
├── .env.example        # Environment variable template
└── src/
    ├── main.tsx        # Application bootstrap / React root
    ├── App.tsx         # Root component and top-level routing
    ├── types.ts        # Shared TypeScript types
    ├── api/
    │   └── client.ts   # HTTP client for checkout-service & inventory-api
    ├── components/     # Reusable UI components
    ├── pages/          # Route-level page components
    └── utils/          # Pure utility helpers (cart, promo, …)
```

## Structure

- `src/api/` — backend client
- `src/components/` — shared UI
- `src/pages/` — route-level views
