import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { formatCents, parseAmountCents } from "@/lib/money";
import {
  computeEqualPreview,
  computeExactPreview,
  exactPayloadShares,
  type SplitType,
} from "@/lib/split";
import type { ExpensePayload } from "@/lib/api";

interface ExpenseFormProps {
  /** Group members in the order the backend reports them. */
  members: string[];
  currentUser: string;
  submitting: boolean;
  /** Returns true when the expense was recorded (form then resets). */
  onSubmit: (payload: ExpensePayload) => Promise<boolean>;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-400 dark:focus:ring-neutral-700";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

/**
 * Requirements 2 & 3: expense entry (description, amount, payer, equal/exact
 * split) with a live split preview. The preview is derived state — recomputed
 * from the raw inputs on every keystroke — and the split rules live in
 * `lib/split.ts`, byte-for-byte aligned with the backend, so what you see is
 * exactly what the API will store.
 *
 * For exact splits the unallocated amount is displayed and submission stays
 * disabled until the shares sum to the total.
 */
export function ExpenseForm({ members, currentUser, submitting, onSubmit }: ExpenseFormProps) {
  const [description, setDescription] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [payer, setPayer] = useState(() => (members.includes(currentUser) ? currentUser : ""));
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(members));
  const [exactRaw, setExactRaw] = useState<Record<string, string>>({});

  const amount = parseAmountCents(amountRaw);
  const amountValid = amount.ok && amount.cents > 0;
  // 0 until the amount parses — previews show "—" placeholders meanwhile.
  const totalCents = amount.ok ? amount.cents : 0;

  const equalPreview = computeEqualPreview(totalCents, members, selected);
  const exactPreview = computeExactPreview(totalCents, members, exactRaw);

  const descriptionValid = description.trim().length > 0;
  const payerValid = payer !== "" && members.includes(payer);
  const splitValid = splitType === "equal" ? equalPreview.hasSelection : exactPreview.balanced;
  const canSubmit = !submitting && amountValid && descriptionValid && payerValid && splitValid;

  function toggleMember(member: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(member)) {
        next.delete(member);
      } else {
        next.add(member);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !amount.ok) return;
    const payload: ExpensePayload = {
      description: description.trim(),
      paid_by: payer,
      amount: formatCents(amount.cents),
      split:
        splitType === "equal"
          ? { type: "equal", members: equalPreview.selectedMembers }
          : { type: "exact", shares: exactPayloadShares(exactPreview) },
    };
    const recorded = await onSubmit(payload);
    if (recorded) {
      // Keep payer, split type and member selection for rapid consecutive entry.
      setDescription("");
      setAmountRaw("");
      setExactRaw({});
    }
  }

  const unallocated = exactPreview.unallocatedCents;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800"
      aria-labelledby="expense-heading"
    >
      <h2 id="expense-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        3 · New expense
      </h2>

      <div className="mt-3 grid gap-4">
        <Field label="Description" htmlFor="expense-description">
          <input
            id="expense-description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Dinner at the night market"
            className={inputClass}
          />
        </Field>

        <Field
          label="Amount (THB)"
          htmlFor="expense-amount"
          hint={
            amountRaw.trim() !== "" && !amount.ok ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{amount.error}</p>
            ) : null
          }
        >
          <input
            id="expense-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountRaw}
            onChange={(event) => setAmountRaw(event.target.value)}
            placeholder="1000.00"
            className={inputClass}
          />
        </Field>

        <Field label="Paid by" htmlFor="expense-payer">
          <select
            id="expense-payer"
            value={payer}
            onChange={(event) => setPayer(event.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a member…
            </option>
            {members.map((member) => (
              <option key={member} value={member}>
                {member}
                {member === currentUser ? " (you)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium">Split type</legend>
          <div className="flex gap-2">
            {(
              [
                { value: "equal", label: "Equal among selected" },
                { value: "exact", label: "Exact amounts" },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                  splitType === option.value
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 bg-white hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-400"
                }`}
              >
                <input
                  type="radio"
                  name="split-type"
                  value={option.value}
                  checked={splitType === option.value}
                  onChange={() => setSplitType(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {splitType === "equal" ? (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Split among</legend>
            <ul className="grid gap-1 sm:grid-cols-2">
              {members.map((member) => (
                <li key={member}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <input
                      type="checkbox"
                      checked={selected.has(member)}
                      onChange={() => toggleMember(member)}
                      className="size-4 accent-neutral-900 dark:accent-white"
                    />
                    {member}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex gap-3 text-xs">
              <button
                type="button"
                className="text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={() => setSelected(new Set(members))}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          </fieldset>
        ) : (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Exact amounts per member (THB)</legend>
            <ul className="grid gap-2 sm:grid-cols-2">
              {exactPreview.entries.map((entry) => (
                <li key={entry.member}>
                  <label htmlFor={`exact-${entry.member}`} className="sr-only">
                    Share for {entry.member}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                      {entry.member}
                    </span>
                    <input
                      id={`exact-${entry.member}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={entry.raw}
                      onChange={(event) =>
                        setExactRaw((previous) => ({ ...previous, [entry.member]: event.target.value }))
                      }
                      className={`${inputClass} pl-20 ${
                        entry.cents === null && !entry.blank
                          ? "border-red-400 focus:border-red-500 focus:ring-red-300 dark:border-red-700"
                          : ""
                      }`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>

      {/* Live split preview — requirement 3. Recomputed on every keystroke. */}
      <div
        aria-live="polite"
        className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/60"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Live split preview
        </p>
        {!amountValid ? (
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            Enter a valid amount to see the preview.
          </p>
        ) : (
          <>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {members.map((member) => {
                  const exactEntry =
                    splitType === "exact"
                      ? exactPreview.entries.find((entry) => entry.member === member)
                      : undefined;
                  // Equal: unselected members show "—". Exact: blank → 0.00,
                  // invalid input → "—" until fixed.
                  const share =
                    splitType === "equal"
                      ? (equalPreview.shares.get(member) ?? null)
                      : exactEntry && !exactEntry.blank
                        ? exactEntry.cents
                        : exactEntry
                          ? 0
                          : null;
                  return (
                    <tr key={member} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                      <td className="py-1.5">
                        {member}
                        {member === payer ? <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">· paid</span> : null}
                        {member === currentUser ? <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">· you</span> : null}
                        {!entryIncluded(splitType, equalPreview, member) ? (
                          <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">· not included</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-right font-mono tabular-nums">
                        {share === null ? "—" : formatCents(share)}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="pt-1.5 font-medium">Total</td>
                  <td className="pt-1.5 text-right font-mono tabular-nums font-medium">{formatCents(amount.cents)}</td>
                </tr>
              </tbody>
            </table>
            {splitType === "exact" && (
              <p
                className={`mt-2 text-xs ${
                  unallocated === 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {unallocated > 0
                  ? `Unallocated: ${formatCents(unallocated)} — submission is disabled until the shares add up to ${formatCents(amount.cents)}.`
                  : unallocated < 0
                    ? `Over-allocated by ${formatCents(-unallocated)} — reduce the shares to enable submission.`
                    : "Balanced — the shares add up to the total."}
              </p>
            )}
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Recording…" : "Add expense"}
      </button>
      {!canSubmit && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {descriptionValid ? null : "Enter a description. "}
          {amountValid ? null : "Enter a positive amount with up to 2 decimals. "}
          {payerValid ? null : "Choose who paid. "}
          {amountValid && descriptionValid && payerValid && splitType === "equal" && !equalPreview.hasSelection
            ? "Select at least one member. "
            : null}
          {amountValid && descriptionValid && payerValid && splitType === "exact" && !exactPreview.balanced
            ? exactPreview.invalidMembers.length > 0
              ? "Fix the highlighted share amounts. "
              : "The shares must add up to the total. "
            : null}
        </p>
      )}
    </form>
  );
}

/** True when the member takes part in the current split (for preview annotations). */
function entryIncluded(
  splitType: SplitType,
  equalPreview: { shares: Map<string, number> },
  member: string,
): boolean {
  if (splitType === "equal") return equalPreview.shares.has(member);
  return true;
}