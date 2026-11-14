/**
 * Split preview computation — the single source of truth for what the UI shows
 * while an expense is being entered. It mirrors the backend's rules so the
 * preview and the stored expense always agree:
 *
 * - Equal splits: integer-cent division with leftover cents going one at a
 *   time to members in list order (AI_NOTES.md §4.2).
 * - Exact splits: every entered share must be a valid amount and the shares
 *   must sum exactly to the total, otherwise submission stays disabled
 *   (AI_NOTES.md §4.3).
 */

import { equalSplitCents, parseAmountCents, serializeCents, sumCents } from "./money";

export type SplitType = "equal" | "exact";

export interface EqualPreview {
  /** Selected members, in group member order — this is the order sent to the API. */
  selectedMembers: string[];
  /** member → share in cents, for the selected members only. */
  shares: Map<string, number>;
  /** False when nobody is selected (submission blocked). */
  hasSelection: boolean;
}

export function computeEqualPreview(
  totalCents: number,
  members: string[],
  selected: ReadonlySet<string>,
): EqualPreview {
  const selectedMembers = members.filter((member) => selected.has(member));
  const shareList = equalSplitCents(totalCents, selectedMembers.length);
  return {
    selectedMembers,
    shares: new Map(selectedMembers.map((member, index) => [member, shareList[index] ?? 0])),
    hasSelection: selectedMembers.length > 0,
  };
}

export interface ExactShare {
  member: string;
  /** Raw input as typed ("" when left blank). */
  raw: string;
  /** True when the member was left blank — counts as 0.00. */
  blank: boolean;
  /** Parsed cents, or null while the raw input is not a valid amount. */
  cents: number | null;
}

export interface ExactPreview {
  entries: ExactShare[];
  /** Members whose raw input is not a valid amount (submission blocked). */
  invalidMembers: string[];
  allocatedCents: number;
  /**
   * total − allocated: > 0 = still to assign, < 0 = over-allocated, 0 = balanced.
   * Submission stays disabled until this is exactly 0 with no invalid inputs.
   */
  unallocatedCents: number;
  balanced: boolean;
}

export function computeExactPreview(
  totalCents: number,
  members: string[],
  rawShares: Readonly<Record<string, string>>,
): ExactPreview {
  const entries: ExactShare[] = members.map((member) => {
    const raw = rawShares[member] ?? "";
    const blank = raw.trim() === "";
    const parsed = blank ? { ok: true, cents: 0 } : parseAmountCents(raw);
    return { member, raw, blank, cents: parsed.ok ? parsed.cents : null };
  });
  const invalidMembers = entries
    .filter((entry) => entry.cents === null)
    .map((entry) => entry.member);
  const allocatedCents = sumCents(
    entries.map((entry) => entry.cents).filter((cents): cents is number => cents !== null),
  );
  const unallocatedCents = totalCents - allocatedCents;
  const balanced =
    totalCents > 0 && invalidMembers.length === 0 && unallocatedCents === 0 && entries.length > 0;
  return { entries, invalidMembers, allocatedCents, unallocatedCents, balanced };
}

/**
 * Canonical `shares` payload for an exact split: only members with a value
 * entered, amounts serialized as "1234.50"-style strings (2 decimals) exactly
 * like the backend serializes money.
 */
export function exactPayloadShares(preview: ExactPreview): Record<string, string> {
  return Object.fromEntries(
    preview.entries
      .filter((entry): entry is ExactShare & { cents: number } => !entry.blank && entry.cents !== null)
      .map((entry) => [entry.member, formatCents(entry.cents)]),
  );
}
