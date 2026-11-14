/**
 * Typed client for the SplitBill backend API, called through a same-origin
 * Next.js rewrite (`/api/*` → backend origin, see next.config.ts) so no CORS
 * setup is needed.
 *
 * Contract (backend/README.md + backend/AI_NOTES.md §5, auth per AI_NOTES.md §4.1):
 * - Identity travels in the HttpOnly `sb_session` cookie set by
 *   `POST /auth/login` / `POST /auth/register`. Same-origin fetches send it
 *   automatically; JavaScript never sees the token.
 * - `POST /groups/{id}/expenses` requires an `Idempotency-Key` header.
 * - Money travels as strings: "1000.00".
 * - Every error response is `{"detail": "<human-readable message>"}`.
 */

import { equalSplitCents, parseAmountCents, parseSignedCents } from "./money";

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

export interface SessionUser {
  username: string;
}

export type ExpensePayload = {
  description: string;
  paid_by: string;
  /** Canonical amount string, e.g. "1000.00" — always from `serializeCents`. */
  amount: string;
  split: { type: "equal"; members: string[] } | { type: "exact"; shares: Record<string, string> };
};

/** Status used when the server answered with a shape the client can't read. */
export const UNEXPECTED_RESPONSE = -1;

/**
 * A failed request. `detail` is the backend's human-readable message when it
 * sent one; otherwise the UI picks wording from `status` (0 = the server could
 * not be reached; UNEXPECTED_RESPONSE = it answered with an unreadable shape).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, detail: string | null) {
    super(detail ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

interface ApiCallOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
}

function detailOf(body: unknown): string | null {
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : undefined;
  if (typeof detail !== "string") return null;
  const trimmed = detail.trim();
  // FastAPI's bare "Not Found" says nothing useful to a person.
  return trimmed && trimmed.toLowerCase() !== "not found" ? trimmed : null;
}

async function apiFetch<T>(path: string, options: ApiCallOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, null);
  }

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, detailOf(body));
  return body as T;
}

/* ------------------------------------------------------------------ */
/* Response normalization                                              */
/* ------------------------------------------------------------------ */

/**
 * The backend pins money to strings but not (yet) the exact collection
 * envelopes. These normalizers accept the canonical shapes (bare arrays,
 * `[{"member", "balance"}]`) plus the obvious wrapped/map variants, so the UI
 * keeps working as the backend schema settles.
 */
function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of ["groups", "expenses", "balances", "items", "results"]) {
      const nested = (data as Record<string, unknown>)[key];
      if (Array.isArray(nested)) return nested;
    }
  }
  throw new ApiError(UNEXPECTED_RESPONSE, null);
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

function toSessionUser(data: unknown): SessionUser {
  if (data && typeof data === "object" && typeof (data as { username?: unknown }).username === "string") {
    return { username: (data as { username: string }).username };
  }
  throw new ApiError(UNEXPECTED_RESPONSE, null);
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
  throw new ApiError(UNEXPECTED_RESPONSE, null);
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface Credentials {
  username: string;
  password: string;
}

/** The signed-in user, or null when there is no valid session. */
export async function fetchSession(): Promise<SessionUser | null> {
  try {
    return toSessionUser(await apiFetch<unknown>("/auth/me"));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function login(credentials: Credentials): Promise<SessionUser> {
  return toSessionUser(await apiFetch<unknown>("/auth/login", { method: "POST", body: credentials }));
}

export async function register(credentials: Credentials): Promise<SessionUser> {
  return toSessionUser(
    await apiFetch<unknown>("/auth/register", { method: "POST", body: credentials }),
  );
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

/* ------------------------------------------------------------------ */
/* Groups, expenses, balances                                          */
/* ------------------------------------------------------------------ */

export async function fetchGroups(): Promise<Group[]> {
  return asArray(await apiFetch<unknown>("/groups"))
    .map(toGroup)
    .filter((group): group is Group => group !== null);
}

export async function fetchGroup(groupId: number): Promise<Group> {
  const group = toGroup(await apiFetch<unknown>(`/groups/${groupId}`));
  if (!group) throw new ApiError(UNEXPECTED_RESPONSE, null);
  return group;
}

export async function fetchExpenses(groupId: number): Promise<Expense[]> {
  return asArray(await apiFetch<unknown>(`/groups/${groupId}/expenses`))
    .map(toExpense)
    .filter((expense): expense is Expense => expense !== null);
}

export async function fetchBalances(groupId: number): Promise<BalanceEntry[]> {
  return normalizeBalances(await apiFetch<unknown>(`/groups/${groupId}/balances`));
}

/**
 * Record an expense. The caller owns the `Idempotency-Key`: keep the same key
 * while retrying one draft (so a timed-out submit is never stored twice) and
 * rotate it after a success (AI_NOTES.md §4.6).
 */
export async function createExpense(
  groupId: number,
  payload: ExpensePayload,
  idempotencyKey: string,
): Promise<Expense | null> {
  const body = await apiFetch<unknown>(`/groups/${groupId}/expenses`, {
    method: "POST",
    body: payload,
    idempotencyKey,
  });
  return toExpense(body);
}

export async function deleteExpense(groupId: number, expenseId: number): Promise<void> {
  await apiFetch(`/groups/${groupId}/expenses/${expenseId}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Each member's share of an expense in cents, in split order — recomputed with
 * the same rules the backend uses, for the per-bill tier stack. Empty when the
 * split is missing or malformed.
 */
export function expenseShares(expense: Expense): { member: string; cents: number }[] {
  const split = expense.split;
  const total = parseAmountCents(expense.amount);
  if (!split || !total.ok) return [];
  if (split.type === "equal" && Array.isArray(split.members)) {
    const shares = equalSplitCents(total.cents, split.members.length);
    return split.members.map((member, index) => ({ member, cents: shares[index] ?? 0 }));
  }
  if (split.type === "exact" && split.shares) {
    return Object.entries(split.shares).map(([member, raw]) => {
      const parsed = parseAmountCents(raw);
      return { member, cents: parsed.ok ? parsed.cents : 0 };
    });
  }
  return [];
}
