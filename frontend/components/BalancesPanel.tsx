"use client";

import type { BalanceEntry } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { memberColor } from "@/lib/members";
import { formatCents } from "@/lib/money";

interface BalancesPanelProps {
  balances: BalanceEntry[];
  /** Household member order — sets each roommate's colour. */
  members: string[];
  currentUser: string;
}

function signed(cents: number): string {
  if (cents > 0) return `+${formatCents(cents)}`;
  if (cents < 0) return `−${formatCents(-cents)}`;
  return formatCents(0);
}

/**
 * Where everyone stands, as one card: your position as a sentence, then every
 * roommate on one diverging scale (right = owed money, left = owes it;
 * positive = owed to that member, per the backend). Figures stay in ink — the
 * sign and the words carry direction, and colour stays the roommate's own.
 * The sentence and the scale sit side by side only when the card is wide.
 */
export function BalancesPanel({ balances, members, currentUser }: BalancesPanelProps) {
  const { t } = useI18n();
  const mine = balances.find((entry) => entry.member === currentUser)?.cents ?? 0;
  const scale = Math.max(1, ...balances.map((entry) => Math.abs(entry.cents)));

  return (
    <section aria-labelledby="balances-heading" className="@container rounded-2xl bg-surface p-6 shadow-surface">
      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] @4xl:gap-10">
        <div>
          <h2 id="balances-heading" className="text-sm font-semibold text-ink-2">
            {t("balance.title")}
          </h2>
          <p className="mt-2 text-2xl leading-snug font-semibold text-ink">
            {mine === 0 ? (
              t("balance.settled")
            ) : (
              <>
                {/* Phrase and figure each stay whole, so Thai never breaks mid-phrase. */}
                <span className="whitespace-nowrap">{mine > 0 ? t("balance.youOwed") : t("balance.youOwe")}</span>{" "}
                <span className="num text-[2.25rem] font-bold tracking-tight whitespace-nowrap">
                  {formatCents(Math.abs(mine))}
                </span>
              </>
            )}
          </p>
          <p className="mt-2 text-sm text-ink-3">{t("balance.scope")}</p>
        </div>

        {balances.length === 0 ? (
          <p className="self-center text-sm text-ink-3">{t("balance.empty")}</p>
        ) : (
          <ul className="grid content-center gap-3">
            {balances.map((entry) => {
              const color = memberColor(members, entry.member);
              const width = `${(Math.abs(entry.cents) / scale) * 50}%`;
              const state =
                entry.cents > 0 ? t("balance.isOwed") : entry.cents < 0 ? t("balance.owes") : t("balance.settledShort");
              return (
                <li
                  key={entry.member}
                  className="grid grid-cols-[6.5rem_minmax(4rem,1fr)_7.5rem] items-center gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.fill }} />
                    <span className="truncate font-medium text-ink">
                      {entry.member}
                      {entry.member === currentUser ? (
                        <span className="font-normal text-ink-3"> ({t("common.you")})</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="relative h-2.5 rounded-full bg-sunken" aria-hidden="true">
                    <span className="absolute inset-y-[-3px] left-1/2 w-px bg-steel-400" />
                    {entry.cents !== 0 && (
                      <span
                        className="absolute inset-y-0 rounded-full"
                        style={{
                          width,
                          backgroundColor: color.fill,
                          ...(entry.cents > 0 ? { left: "50%" } : { right: "50%" }),
                        }}
                      />
                    )}
                  </span>
                  <span className="text-right">
                    <span className="num block font-semibold text-ink">{signed(entry.cents)}</span>
                    <span className="block text-xs text-ink-3">{state}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
