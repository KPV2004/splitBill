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

Open http://localhost:3000 and enter `alice`, `bob`, `carol` or `dave`. The mock ships three
groups: **Bangkok Trip** (alice, bob, carol), **Office Lunch** (alice, bob) and
**Chiang Mai 2026** (bob, carol, dave). Its data lives in memory and resets on restart.

### Against the real backend

Start the backend first (see [../backend/README.md](../backend/README.md)), then:

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

- Identity goes in the `X-User` header (the name you enter).
- Creating an expense sends an `Idempotency-Key` header so a retry can't create a duplicate.
- Money goes over the wire as strings with 2 decimals and no separators: `"1000.00"`.
- Errors arrive as `{"detail": "..."}` and are shown to the user as written. If `detail` is
  missing, `lib/api.ts` falls back to a plain-language message for the status code.

## Project structure

```
frontend/
├── app/
│   ├── layout.tsx            root layout, Geist fonts, metadata
│   ├── page.tsx              the whole app: state, data loading, create/delete handlers
│   └── globals.css           Tailwind entry
├── components/
│   ├── UserGroupPicker.tsx   1 · user name + group list
│   ├── ExpenseForm.tsx       3 · new expense form + live split preview
│   ├── BalancesPanel.tsx     5 · per-member balances (owed / owes / settled)
│   ├── ExpenseList.tsx       expense list, payer-only delete with confirm
│   └── Banner.tsx            dismissible error / success banners
├── lib/
│   ├── api.ts                typed API client, response normalizers, error messages
│   ├── money.ts              integer-satang parse / format / serialize, equal split
│   ├── split.ts              equal and exact split preview logic
│   └── *.test.ts             Vitest unit tests
├── scripts/
│   └── mock-backend.mjs      dev-only mock of the full API contract
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
- **Exact split:** the Add button stays disabled until the shares add up to the total; the
  preview shows what's left to assign or how much is over.
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

## Known issues

Tracked in [../AI_NOTES.md §3](../AI_NOTES.md):

- `lib/split.ts` calls `formatCents` without importing it, which breaks the type check and one
  test. It should use `serializeCents`.
- `ExpenseForm.tsx` sends the amount with `formatCents`, so amounts of 1,000 or more go out as
  `"1,000.00"` and the backend will reject them.
- A new `Idempotency-Key` is generated on every click, so retrying after a timeout can create a
  duplicate. It should be kept per draft.

## Notes for contributors

- This is **Next.js 16**, which has breaking changes. Read the guides in
  `node_modules/next/dist/docs/` before using Next APIs (see [AGENTS.md](AGENTS.md)).
- Never use floats for money; use the helpers in `lib/money.ts`.
- If the API contract changes, update `lib/api.ts`, `scripts/mock-backend.mjs` and
  [../AI_NOTES.md §4](../AI_NOTES.md) together.
