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

## Structure

- `src/api/` — backend client
- `src/components/` — shared UI
- `src/pages/` — route-level views
