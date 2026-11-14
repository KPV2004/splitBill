import { formatCents } from "@/lib/money";
import type { BalanceEntry } from "@/lib/api";

interface BalancesPanelProps {
  balances: BalanceEntry[];
  currentUser: string | null;
}

/**
 * Requirement 5: per-member balances with "owed to" vs "owes" clearly
 * distinguished — by color, sign and wording (positive = owed to that member,
 * negative = they owe, matching the backend contract).
 */
export function BalancesPanel({ balances, currentUser }: BalancesPanelProps) {
  return (
    <section
      aria-labelledby="balances-heading"
      className="rounded-xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="balances-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          5 · Balances
        </h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">THB</span>
      </div>
      {balances.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">No balances to show yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {balances.map((entry) => {
            const isOwed = entry.cents > 0;
            const owes = entry.cents < 0;
            return (
              <li
                key={entry.member}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800"
              >
                <span className="text-sm font-medium">
                  {entry.member}
                  {entry.member === currentUser ? (
                    <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">(you)</span>
                  ) : null}
                </span>
                <span
                  className={`text-sm font-semibold font-mono tabular-nums ${
                    isOwed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : owes
                        ? "text-red-600 dark:text-red-400"
                        : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {isOwed
                    ? `is owed ${formatCents(entry.cents)}`
                    : owes
                      ? `owes ${formatCents(-entry.cents)}`
                      : "settled up"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Positive balances are owed <em>to</em> that member; negative ones are owed <em>by</em> them.
      </p>
    </section>
  );
}
