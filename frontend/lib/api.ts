/**
 * Typed client for the SplitBill backend API, called through a same-origin
 * Next.js rewrite (`/api/*` → backend origin, see next.config.ts) so no CORS
 * setup is needed.
 *
 * Contract (backend/README.md + backend/AI_NOTES.md §5):
 * - Identity travels in the `X-User` header (username).
 * - `POST /groups/{id}/expenses` requires an `Idempotency-Key` header.
 * - Money travels as strings: "1000.00".
 * - Every error response is `{"detail": "<human-readable message>"}`.
 */

import { parseSignedCents } from "./money";

export interface Group {
  id: number;
  name: string;
  /** Present on GET /groups/{id}; may be absent on GET /groups. */
  members?: string[];
}

export type ExpenseSplit = {
  type?: string;
  members?: string[];
  shares?: Record<string, string>;
};

export interface Expense {
  id: number;
  description: string;
  paid_by: string;
  amount: string;
  split?: ExpenseSplit;
  created_at?: string;
}

export interface BalanceEntry {
  member: string;
  balance: string;
  /** Signed cents parsed from `balance` (positive = owed to the member). */
  cents: number;
}

export type ExpensePayload = {
  description: string;
  paid_by: string;
  /** Canonical amount string, e.g. "1000.00". */
  amount: string;
  split: { type: "equal"; members: string[] } | { type: "exact"; shares: Record<string, string> };
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Error presentation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Turn an error response into a plain-language sentence. Backend `detail`
 * messages are written for humans (e.g. "The shares do not add up to the
 * total", "Not a member of this group") and pass through verbatim; only
 * technical/empty details fall back to status-based wording.
 */
function toErrorMessage(status: number, body: unknown, notFoundMessage?: string): string {
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : undefined;
  if (typeof detail === "string" && detail.trim() && detail.trim().toLowerCase() !== "not found") {
    return detail.trim();
  }
  if (status === 404) return notFoundMessage ?? "Not found.";
  switch (status) {
    case 400:
      return "The request was rejected. Please check the entered amounts.";
    case 401:
      return "Please choose a user first.";
    case 403:
      return "You are not allowed to do that.";
    case 409:
      return "This submission conflicts with an earlier one. Please try again.";
    case 422:
      return "The request was not valid. Please check the entered values.";
    case 502:
    case 503:
    case 504:
      return "The server is temporarily unavailable. Please try again shortly.";
    default:
      return `Something went wrong (HTTP ${status}). Please try again.`;
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

interface ApiCallOptions {
  method?: string;
  /** Username sent as the X-User header. */
  user?: string;
  body?: unknown;
  idempotencyKey?: string;
  /** Plain-language replacement for generic 404 responses. */
  notFoundMessage?: string;
}

async function apiFetch<T>(path: string, options: ApiCallOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.user) headers["X-User"] = options.user;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check that the backend is running.");
  }

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, toErrorMessage(response.status, body, options.notFoundMessage));
  }
  return body as T;
}

/* ------------------------------------------------------------------ */
/* Response normalization                                              */
/* ------------------------------------------------------------------ */

/**
 * The backend pins money to strings but not (yet) the exact collection
 * envelopes. These normalizers accept the canonical shapes (bare arrays,
 * `[{"member", "balance"}]`) plus the obvious wrapped/map variants, so the UI
 * keeps working as the backend schema settles. Documented in README.md.
 */
function asArray(data: unknown, what: string): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of ["groups", "expenses", "balances", "items", "results"]) {
      const nested = (data as Record<string, unknown>)[key];
      if (Array.isArray(nested)) return nested;
    }
  }
  throw new ApiError(0, `The server sent an unexpected response while loading ${what}.`);
}

function toId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function toGroup(data: unknown): Group | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const id = toId(raw.id);
  if (id === null || typeof raw.name !== "string") return null;
  return { id, name: raw.name, members: toStringArray(raw.members) };
}

function toExpense(data: unknown): Expense | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const id = toId(raw.id);
  if (id === null || typeof raw.description !== "string" || typeof raw.paid_by !== "string") {
    return null;
  }
  return {
    id,
    description: raw.description,
    paid_by: raw.paid_by,
    amount: typeof raw.amount === "string" ? raw.amount : String(raw.amount ?? ""),
    split: raw.split && typeof raw.split === "object" ? (raw.split as ExpenseSplit) : undefined,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
  };
}

function toBalance(data: unknown): BalanceEntry | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const member = [raw.member, raw.username, raw.name].find((v): v is string => typeof v === "string");
  const balance = [raw.balance, raw.net_balance, raw.amount].find(
    (v): v is string => typeof v === "string",
  );
  if (member === undefined || balance === undefined) return null;
  const cents = parseSignedCents(balance) ?? 0;
  return { member, balance, cents };
}

function normalizeGroups(data: unknown): Group[] {
  return asArray(data, "your groups")
    .map(toGroup)
    .filter((group): group is Group => group !== null);
}

function normalizeExpenses(data: unknown): Expense[] {
  return asArray(data, "expenses")
    .map(toExpense)
    .filter((expense): expense is Expense => expense !== null);
}

function normalizeBalances(data: unknown): BalanceEntry[] {
  // Preferred: [{"member": "alice", "balance": "666.66"}]; also accepted:
  // {"alice": "666.66"} — until the backend pins the schema.
  if (Array.isArray(data)) {
    return data.map(toBalance).filter((entry): entry is BalanceEntry => entry !== null);
  }
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([member, balance]) => toBalance({ member, balance }))
      .filter((entry): entry is BalanceEntry => entry !== null);
  }
  throw new ApiError(0, "The server sent an unexpected response while loading balances.");
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export async function fetchGroups(user: string): Promise<Group[]> {
  return normalizeGroups(await apiFetch<unknown>("/groups", { user, notFoundMessage: "Could not load your groups." }));
}

export async function fetchGroup(user: string, groupId: number): Promise<Group> {
  const group = toGroup(
    await apiFetch<unknown>(`/groups/${groupId}`, { user, notFoundMessage: "This group was not found. It may have been deleted." }),
  );
  if (!group) throw new ApiError(0, "The server sent an unexpected response for this group.");
  return group;
}

export async function fetchExpenses(user: string, groupId: number): Promise<Expense[]> {
  return normalizeExpenses(await apiFetch<unknown>(`/groups/${groupId}/expenses`, { user }));
}

export async function fetchBalances(user: string, groupId: number): Promise<BalanceEntry[]> {
  return normalizeBalances(await apiFetch<unknown>(`/groups/${groupId}/balances`, { user }));
}

/**
 * Record an expense. The caller generates a fresh `Idempotency-Key` per
 * submission attempt (AI_NOTES.md §4.6) so a retried submit never silently
 * duplicates an expense.
 */
export async function createExpense(
  user: string,
  groupId: number,
  payload: ExpensePayload,
  idempotencyKey: string,
): Promise<Expense | null> {
  const body = await apiFetch<unknown>(`/groups/${groupId}/expenses`, {
    method: "POST",
    user,
    body: payload,
    idempotencyKey,
  });
  return toExpense(body);
}

export async function deleteExpense(user: string, groupId: number, expenseId: number): Promise<void> {
  await apiFetch(`/groups/${groupId}/expenses/${expenseId}`, {
    method: "DELETE",
    user,
    notFoundMessage: "This expense was not found. It may already have been deleted.",
  });
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/** One-line human description of an expense's split for the expense list. */
export function describeSplit(split: ExpenseSplit | undefined): string {
  if (!split || typeof split.type !== "string") return "Split";
  if (split.type === "equal") {
    const count = Array.isArray(split.members) ? split.members.length : null;
    return count !== null ? `Equal split · ${count} member${count === 1 ? "" : "s"}` : "Equal split";
  }
  if (split.type === "exact") {
    const count = split.shares ? Object.keys(split.shares).length : null;
    return count !== null ? `Exact split · ${count} share${count === 1 ? "" : "s"}` : "Exact split";
  }
  return `Split · ${split.type}`;
}
