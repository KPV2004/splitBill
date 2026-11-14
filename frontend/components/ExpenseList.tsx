import { useState } from "react";

import { describeSplit, type Expense } from "@/lib/api";
import { formatCents, parseSignedCents } from "@/lib/money";

interface ExpenseListProps {
  expenses: Expense[];
  /** Delete is payer-only (backend enforces 403); the button only renders for the payer. */
  currentUser: string;
  /** Expense id whose DELETE request is currently in flight. */
  pendingDeleteId: number | null;
  onDelete: (expenseId: number) => void;
}

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatRecordedAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

/**
 * Requirement 5: the expense list, newest first as returned by the API.
 * Deleting is a two-step inline confirm; the button only appears for the
 * expense's payer since the backend rejects anyone else with 403.
 */
export function ExpenseList({ expenses, currentUser, pendingDeleteId, onDelete }: ExpenseListProps) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="expenses-heading"
      className="rounded-xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="expenses-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Expenses
        </h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{expenses.length} total</span>
      </div>

      {expenses.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          No expenses yet — add the first one with the form.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {expenses.map((expense) => {
            const cents = parseSignedCents(expense.amount) ?? 0;
            const recordedAt = formatRecordedAt(expense.created_at);
            const isDeleting = pendingDeleteId === expense.id;
            return (
              <li
                key={expense.id}
                className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{expense.description}</p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      Paid by {expense.paid_by}
                      {expense.paid_by === currentUser ? " (you)" : ""} · {describeSplit(expense.split)}
                      {recordedAt ? ` · ${recordedAt}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold font-mono tabular-nums">
                    {formatCents(cents)}
                  </span>
                </div>
                {expense.paid_by === currentUser && (
                  <div className="mt-2 flex items-center gap-2">
                    {confirmingId === expense.id ? (
                      <>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">Delete this expense?</span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => {
                            setConfirmingId(null);
                            onDelete(expense.id);
                          }}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(expense.id)}
                        disabled={pendingDeleteId !== null}
                        className="text-xs text-red-600 underline transition hover:text-red-500 disabled:opacity-50 dark:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
