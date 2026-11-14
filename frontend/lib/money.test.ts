import { describe, expect, it } from "vitest";

import { equalSplitCents, formatCents, parseAmountCents, parseSignedCents, sumCents } from "./money";

/** Parse helper for tests that already know the amount is valid. */
function centsOf(raw: string): number {
  const parsed = parseAmountCents(raw);
  if (!parsed.ok) throw new Error(`unexpected invalid amount: ${raw}`);
  return parsed.cents;
}

describe("parseAmountCents", () => {
  it.each([
    ["1000", 100000],
    ["1000.5", 100050],
    ["1000.50", 100050],
    ["0.1", 10],
    ["0.01", 1],
    ["1,000.00", 100000],
    [" 1,000.00 ", 100000],
    ["9999999999999.99", 999999999999999],
  ])("parses %s to %i cents", (raw, expected) => {
    expect(parseAmountCents(raw)).toEqual({ ok: true, cents: expected });
  });

  it.each([
    ["", "Enter an amount"],
    ["   ", "Enter an amount"],
    ["abc", "Enter a positive amount like 250 or 250.50"],
    ["-5", "Enter a positive amount like 250 or 250.50"],
    ["1.234", "THB amounts use at most 2 decimal places"],
    ["1e3", "Enter a positive amount like 250 or 250.50"],
    [".5", "Enter a positive amount like 250 or 250.50"],
    ["10000000000000.00", "That amount is too large"],
  ])("rejects %s", (raw, error) => {
    expect(parseAmountCents(raw)).toEqual({ ok: false, error });
  });
});

describe("parseSignedCents", () => {
  it("parses negative balances", () => {
    expect(parseSignedCents("-333.33")).toBe(-33333);
    expect(parseSignedCents("666.66")).toBe(66666);
    expect(parseSignedCents("0.00")).toBe(0);
    expect(parseSignedCents("-0.00")).toBe(0);
  });

  it("returns null for invalid strings", () => {
    expect(parseSignedCents("abc")).toBeNull();
    expect(parseSignedCents("")).toBeNull();
    expect(parseSignedCents("-1.234")).toBeNull();
  });
});

describe("formatCents", () => {
  it.each([
    [100000, "1,000.00"],
    [3334, "33.34"],
    [10, "0.10"],
    [0, "0.00"],
    [-33333, "-333.33"],
    [123456789012, "1,234,567,890.12"],
    [999999999999999, "9,999,999,999,999.99"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it("renders 0.1 + 0.2 as exactly 0.30 (no floating-point error)", () => {
    const cents = centsOf("0.1") + centsOf("0.2");
    expect(cents).toBe(30);
    expect(formatCents(cents)).toBe("0.30");
  });
});

describe("equalSplitCents", () => {
  it("matches the backend golden example: 100.00 among 3 → 33.34, 33.33, 33.33", () => {
    expect(equalSplitCents(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it("matches the backend golden example: 1,000.00 among 3 → 333.34, 333.33, 333.33", () => {
    expect(equalSplitCents(100000, 3)).toEqual([33334, 33333, 33333]);
  });

  it("always sums to the total", () => {
    expect(sumCents(equalSplitCents(10000, 3))).toBe(10000);
    expect(sumCents(equalSplitCents(10001, 3))).toBe(10001);
    expect(sumCents(equalSplitCents(7, 3))).toBe(7);
  });

  it("distributes leftover cents one at a time in list order", () => {
    expect(equalSplitCents(10001, 3)).toEqual([3334, 3334, 3333]);
    expect(equalSplitCents(1, 2)).toEqual([1, 0]);
  });

  it("splits evenly when there is no remainder", () => {
    expect(equalSplitCents(10000, 4)).toEqual([2500, 2500, 2500, 2500]);
  });

  it("handles zero totals and empty member lists", () => {
    expect(equalSplitCents(0, 3)).toEqual([0, 0, 0]);
    expect(equalSplitCents(10000, 0)).toEqual([]);
  });
});
