import { describe, expect, it } from "vitest";

import { computeEqualPreview, computeExactPreview, exactPayloadShares } from "./split";

const MEMBERS = ["alice", "bob", "carol"];

describe("computeEqualPreview", () => {
  it("matches the backend golden example: 100.00 three ways → 33.34 / 33.33 / 33.33", () => {
    const preview = computeEqualPreview(10000, MEMBERS, new Set(MEMBERS));
    expect(preview.selectedMembers).toEqual(MEMBERS);
    expect(preview.shares.get("alice")).toBe(3334);
    expect(preview.shares.get("bob")).toBe(3333);
    expect(preview.shares.get("carol")).toBe(3333);
    expect([...preview.shares.values()].reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("distributes shares in group member order, not selection order", () => {
    // "carol" and "alice" selected out of order — shares must follow the
    // group's member list order, because that is the order sent to the API
    // and the backend assigns leftover cents by list order.
    const preview = computeEqualPreview(10000, MEMBERS, new Set(["carol", "alice"]));
    expect(preview.selectedMembers).toEqual(["alice", "carol"]);
    expect(preview.shares.get("alice")).toBe(5000);
    expect(preview.shares.get("carol")).toBe(5000);
    expect(preview.shares.has("bob")).toBe(false);
  });

  it("reports no selection when the selection is empty", () => {
    expect(computeEqualPreview(10000, MEMBERS, new Set()).hasSelection).toBe(false);
  });
});

describe("computeExactPreview", () => {
  it("is balanced when the shares sum exactly to the total", () => {
    const preview = computeExactPreview(10000, MEMBERS, {
      alice: "33.34",
      bob: "33.33",
      carol: "33.33",
    });
    expect(preview.invalidMembers).toEqual([]);
    expect(preview.allocatedCents).toBe(10000);
    expect(preview.unallocatedCents).toBe(0);
    expect(preview.balanced).toBe(true);
  });

  it("reports the unallocated remainder while shares do not add up", () => {
    const preview = computeExactPreview(10000, MEMBERS, {
      alice: "33.30",
      bob: "33.30",
      carol: "33.30",
    });
    expect(preview.allocatedCents).toBe(9990);
    expect(preview.unallocatedCents).toBe(10); // 0.10 THB still unallocated
    expect(preview.balanced).toBe(false);
  });

  it("reports over-allocation as a negative unallocated amount", () => {
    const preview = computeExactPreview(10000, MEMBERS, {
      alice: "40.00",
      bob: "40.00",
      carol: "40.00",
    });
    expect(preview.unallocatedCents).toBe(-2000);
    expect(preview.balanced).toBe(false);
  });

  it("treats blank inputs as 0 and blocks invalid input", () => {
    const blank = computeExactPreview(10000, MEMBERS, { alice: "100.00" });
    expect(blank.entries.find((e) => e.member === "bob")?.cents).toBe(0);
    expect(blank.unallocatedCents).toBe(0);
    expect(blank.balanced).toBe(true);

    const invalid = computeExactPreview(10000, MEMBERS, {
      alice: "abc",
      bob: "33.33",
      carol: "33.33",
    });
    expect(invalid.invalidMembers).toEqual(["alice"]);
    expect(invalid.balanced).toBe(false);
  });
});

describe("exactPayloadShares", () => {
  it("serializes canonical 2-decimal strings, matching backend money format", () => {
    const preview = computeExactPreview(50000, MEMBERS, {
      alice: "250.5",
      bob: "250.00",
      carol: "",
    });
    expect(exactPayloadShares(preview)).toEqual({ alice: "250.50", bob: "250.00" });
  });
});
