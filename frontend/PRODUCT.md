# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Roommates and housemates who share recurring household costs (rent, utilities, internet,
groceries, cleaning supplies) over months. They mostly use SplitBill on a **desktop or laptop
browser**, entering expenses after the fact and checking who owes whom before settling up.
Each person has their own account and belongs to one or more households (groups).

## Product Purpose

Keep a shared, trustworthy ledger of household spending so nobody has to do the maths or
remember who paid for what. Success means every member can see, at a glance, their balance in
each household, and the numbers are always exact to the satang and always add up to zero.

## Positioning

Exact, transparent arithmetic: every amount is integer satang end to end, equal splits assign
leftover satang deterministically (one at a time, in member order), exact splits must add up
before they can be saved, and the live preview shows exactly what will be stored.

## Operating Context

- Long-lived groups (a household) with many expenses accumulating over months.
- One person usually pays a bill, then records it and splits it equally or by exact amounts
  (e.g. a bigger room pays a bigger share of rent).
- Members check balances periodically to settle up.
- Only the payer can delete an expense.

## Capabilities and Constraints

- Currency is THB only, always shown with exactly 2 decimals.
- Accounts: register and log in with a username and password; sessions via an HttpOnly cookie.
  In this phase auth runs against `scripts/mock-backend.mjs`; the FastAPI backend does not
  implement it yet.
- Groups come from seed data; there is no create-group or member-management flow yet.
- No edit-expense, settlement recording, or "who pays whom" suggestions yet (planned).
- UI language: **Thai and English**, switchable by the user.
- Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript; the browser talks to the
  API through the `/api/*` same-origin rewrite.

## Brand Commitments

Name: **SplitBill**. No logo or other brand assets exist yet.

## Evidence on Hand

Demo data only (mock backend users alice, bob, carol, dave and three groups). No customers,
testimonials, or metrics exist; do not invent any.

## Product Principles

1. The numbers are the product: exact, explained, and never surprising.
2. Balances first: the first thing a member should see is where they stand.
3. Prevent mistakes instead of reporting them: block invalid splits before submit.
4. Calm, household-scale tool: quick to scan, no gamification.
5. Equal footing for Thai and English: neither language is an afterthought.

## Accessibility & Inclusion

Thai and English text must both render well (Thai needs taller line-height and a font with Thai
glyphs). Full keyboard operation and visible focus on desktop.
