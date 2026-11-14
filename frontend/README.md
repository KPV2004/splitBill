# SplitBill Frontend

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)

Single-page web client for the SplitBill API. Pick a user and a group, record expenses split
equally or by exact amounts, preview every share as you type, and see who owes whom, all in
THB and computed in integer satang, never floats.

Project overview and API contract: [../README.md](../README.md) ·
Backend: [../backend/README.md](../backend/README.md) ·
Plan and known issues: [../AI_NOTES.md](../AI_NOTES.md)

---

## Quick start

**Prerequisites:** Node.js 20+.

```bash
npm install
```

### Against the mock API (no backend needed)

```bash
npm run mock                                       # terminal 1: mock API on 127.0.0.1:9999
BACKEND_ORIGIN=http://127.0.0.1:9999 npm run dev   # terminal 2: app on localhost:3000
```

Open http://localhost:3000. You'll land on the sign-in screen. Sign in with a demo account
(`alice`, `bob`, `carol` or `dave`, password `splitbill123`), or create a new one on the register
screen. The mock ships three households: **Ari Condo 12A** (alice, bob, carol, with demo bills),
**Lat Phrao House** (alice, bob) and **Chiang Mai Flat** (bob, carol, dave). New accounts start
with no household. Everything lives in memory and resets when the mock restarts.

### Against the real backend

Start the backend first (`make db`, `make migrate`, `make seed`, then `make dev` — see
[../backend/README.md](../backend/README.md)), then:

```bash
npm run dev     # proxies /api/* to http://127.0.0.1:8000 by default
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm test` | Vitest, run once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run mock` | In-memory mock backend on port 9999 (`MOCK_PORT` to change) |
| `npx tsc --noEmit` | Type check |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BACKEND_ORIGIN` | `http://127.0.0.1:8000` | Where `/api/*` requests are proxied |
| `MOCK_PORT` | `9999` | Port for `npm run mock` |

## How it talks to the backend

The browser never calls the backend directly. `next.config.ts` rewrites `/api/*` to
`BACKEND_ORIGIN`, so requests are same-origin and no CORS setup is needed.

- Identity is an HttpOnly session cookie (`sb_session`) set by `POST /auth/login` or
  `POST /auth/register`. The browser sends it automatically; JavaScript never reads it. Any 401
  sends you back to sign in. Contract: [../AI_NOTES.md §4.1](../AI_NOTES.md).
- Creating an expense sends an `Idempotency-Key` header so a retry can't create a duplicate.
- Money goes over the wire as strings with 2 decimals and no separators: `"1000.00"`.
- Errors arrive as `{"detail": "..."}` and are shown to the user as written. If `detail` is
  missing, `lib/api.ts` falls back to a plain-language message for the status code.

## Project structure

```
frontend/
├── app/
│   ├── layout.tsx            root layout, Anuphan font (Thai + Latin), providers
│   ├── page.tsx              household ledger; redirects to /login when signed out
│   ├── login/page.tsx        sign in
│   ├── register/page.tsx     create an account
│   └── globals.css           design tokens (Tailwind @theme) and browser-surface styling
├── components/
│   ├── AuthScreen.tsx        login + register form, validation, brand panel
│   ├── HouseholdRail.tsx     green rail: households, your balance in each, account, language
│   ├── BalancesPanel.tsx     your balance sentence + every roommate on a diverging scale
│   ├── ExpenseList.tsx       bills table (list on phones), mini carriers, payer-only delete
│   ├── ExpenseForm.tsx       new bill, equal/exact split, live carrier, idempotency per draft
│   ├── Carrier.tsx           the "pinto" stack: a bill's shares as proportional tiers
│   ├── Banner.tsx, Icon.tsx, LanguageToggle.tsx, Providers.tsx
├── lib/
│   ├── api.ts                typed API client (cookie auth), normalizers, ApiError
│   ├── auth.tsx              session provider: me / login / register / logout
│   ├── i18n.tsx              Thai + English strings, language switch, error wording
│   ├── members.ts            roommate colours (identity only, by member order)
│   ├── money.ts              integer-satang parse / format / serialize, equal split
│   ├── split.ts              equal and exact split preview logic
│   └── *.test.ts             Vitest unit tests
├── scripts/
│   └── mock-backend.mjs      dev-only mock of the full API contract + auth
└── next.config.ts            /api rewrite, Turbopack + Tailwind
```

## Money rules

All money logic lives in `lib/money.ts` and must match the backend exactly
([../backend/AI_NOTES.md §4](../backend/AI_NOTES.md)).

- Amounts are parsed into **integer satang**. Input with more than 2 decimals is rejected, not
  rounded.
- **Equal split:** leftover satang go one at a time to members in list order.
  1,000.00 among alice, bob and carol → 333.34 / 333.33 / 333.33. The form sends members in
  group member order, so the preview always matches what the backend stores.
- **Exact split:** Save stays disabled until the shares add up to the total; the carrier shows
  what's left as an open tier, or spills over the rim in red when it's over.
- Two formatters, two jobs:
  - `formatCents` → for **display**, with thousands separators: `"1,000.00"`
  - `serializeCents` → for the **API**: `"1000.00"`. Never send `formatCents` output.

## Testing

```bash
npm test          # unit tests for lib/money.ts and lib/split.ts
npx tsc --noEmit  # type check
npm run lint
```

Tests cover parsing edge cases, the equal-split golden example, member ordering, and exact-split
balancing. There are no component tests yet.

## Design

The UI follows the "Pinto" direction (named after the Thai stacked tiffin carrier): a deep
enamel-green rail over a cool steel ground, and each roommate owns one enamel colour used only
to show whose share is whose. Product facts live in [PRODUCT.md](PRODUCT.md); the direction
contract is in `.impeccable/surfaces/app-page-tsx.md`.

## Known gaps

- No dark theme, no component tests, no create-household flow (households are seeded).

## Notes for contributors

- This is **Next.js 16**, which has breaking changes. Read the guides in
  `node_modules/next/dist/docs/` before using Next APIs (see [AGENTS.md](AGENTS.md)).
- Never use floats for money; use the helpers in `lib/money.ts`.
- If the API contract changes, update `lib/api.ts`, `scripts/mock-backend.mjs` and
  [../AI_NOTES.md §4](../AI_NOTES.md) together.
