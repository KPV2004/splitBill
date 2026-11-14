/**
 * Money primitives for THB amounts — integer cents (satang) end to end.
 *
 * Backend rule (backend/AI_NOTES.md §4.1): money is never a float. Amounts enter
 * and leave the API as strings ("1000.00") and every computation happens on
 * integer cents.
 *
 * Everything here is pure string/integer arithmetic. `Number()` is only ever
 * applied to digit-only strings that have been length-checked, so parsing
 * "0.1" yields exactly 10 cents and "0.1" + "0.2" renders "0.30" — never
 * 0.30000000000000004.
 */

/**
 * Accepts "1000", "1000.5", "1000.50" — commas and spaces are stripped by
 * {@link parseAmountCents} before this is applied, so "1,000.00" also parses.
 */
const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Amounts with more than two decimals are rejected, not silently rounded. */
const TOO_MANY_DECIMALS_PATTERN = /^\d+\.\d{3,}$/;

/**
 * Cap: 9,999,999,999,999.99 THB (≈9.99e14 cents). Every intermediate value
 * stays far inside Number.MAX_SAFE_INTEGER (9.007e15), so integer math is exact.
 */
export const MAX_CENTS = 999_999_999_999_999;

export type AmountParse = { ok: true; cents: number } | { ok: false; error: string };

/**
 * Parse a user-entered amount into integer cents. Non-negative only — expense
 * entry never takes a negative amount (balances are computed, not entered).
 */
export function parseAmountCents(raw: string): AmountParse {
  const normalized = raw.trim().replace(/[,\s]/g, "");
  if (normalized === "") {
    return { ok: false, error: "Enter an amount" };
  }
  const match = AMOUNT_PATTERN.exec(normalized);
  if (!match) {
    if (TOO_MANY_DECIMALS_PATTERN.test(normalized)) {
      return { ok: false, error: "THB amounts use at most 2 decimal places" };
    }
    return { ok: false, error: "Enter a positive amount like 250 or 250.50" };
  }
  const whole = match[1] ?? "0";
  const frac = (match[2] ?? "").padEnd(2, "0");
  if (whole.length > 13) {
    return { ok: false, error: "That amount is too large" };
  }
  // Digit-only strings of ≤13 digits are exactly representable doubles, so
  // whole*100 + frac is exact integer math — no floating-point error.
  const cents = Number(whole) * 100 + Number(frac);
  if (cents > MAX_CENTS) {
    return { ok: false, error: "That amount is too large" };
  }
  return { ok: true, cents };
}

/**
 * Parse an amount that may carry a leading "-" (balances coming back from the
 * API). Returns integer cents, or null when the string is not a valid amount.
 */
export function parseSignedCents(raw: string): number | null {
  const normalized = raw.trim().replace(/[,\s]/g, "");
  if (normalized === "") return null;
  const sign = normalized.startsWith("-") ? -1 : 1;
  const digits = sign < 0 ? normalized.slice(1) : normalized;
  const parsed = parseAmountCents(digits);
  if (!parsed.ok) return null;
  const cents = sign * parsed.cents;
  return cents === 0 ? 0 : cents; // normalize -0 (from "-0.00") to +0
}

/**
 * Format integer cents as a THB amount string with Thai-style formatting:
 * comma thousands separators, dot decimal separator, exactly 2 decimals —
 * e.g. 100000 → "1,000.00", 3334 → "33.34", -33333 → "-333.33".
 *
 * Built by hand from integer parts instead of `Intl.NumberFormat` so the
 * output is guaranteed float-free.
 *
 * ⚠️ Display only — the API wire format is {@link serializeCents} (no
 * grouping), matching the backend's `f"{cents // 100}.{cents % 100:02d}"`.
 */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${String(frac).padStart(2, "0")}`;
}

/**
 * Canonical API serialization of integer cents: exactly 2 decimals, no
 * thousands separators — "1000.00", "333.34", "-333.33" (AI_NOTES.md §4.1).
 */
export function serializeCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Split an amount into equal shares in integer cents, with leftover cents
 * distributed one cent at a time to members in list order — mirroring the
 * backend exactly (AI_NOTES.md §4.2):
 *
 *   100.00 among 3 members → 33.34, 33.33, 33.33 (sum = 100.00)
 *
 * The caller must pass members in the same order it sends to the API.
 */
export function equalSplitCents(totalCents: number, memberCount: number): number[] {
  if (memberCount <= 0) return [];
  const base = Math.floor(totalCents / memberCount);
  const remainder = totalCents % memberCount;
  return Array.from({ length: memberCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Sum a list of cent amounts — exact, because every input is an integer. */
export function sumCents(centsList: number[]): number {
  return centsList.reduce((total, cents) => total + cents, 0);
}
