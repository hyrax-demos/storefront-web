# storefront-web

Customer-facing storefront for Hyrax Labs. React + Vite single-page app that
talks to `checkout-service` and `inventory-api`.

## Getting Started

**Prerequisites:** Node.js 18+ and npm 9+.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and set VITE_API_BASE to the backend URL, e.g.:
#   VITE_API_BASE=http://localhost:3000

# 3. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

To create a production build:

```bash
npm run build
```

The compiled output is written to `dist/`. Use `npm run preview` to serve the
build locally and verify it before deploying.

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
