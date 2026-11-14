"use client";

import { useState } from "react";

import { MiniCarrier } from "@/components/Carrier";
import { Icon } from "@/components/Icon";
import { expenseShares, type Expense } from "@/lib/api";
import { countText, useI18n } from "@/lib/i18n";
import { memberColor } from "@/lib/members";
import { formatCents, parseSignedCents } from "@/lib/money";

interface ExpenseListProps {
  expenses: Expense[];
  /** Household member order — sets each roommate's colour. */
  members: string[];
  /** Delete is payer-only (backend enforces 403); the button only renders for the payer. */
  currentUser: string;
  /** Expense id whose DELETE request is currently in flight. */
  pendingDeleteId: number | null;
  onDelete: (expenseId: number) => void;
  /** Open this bill in the form for editing (payer only). */
  onEdit: (expense: Expense) => void;
  /** The bill currently open in the form, highlighted in the list. */
  editingId: number | null;
}

/**
 * The household's bills, newest first as the API returns them. Each row leads
 * with its carrier at row scale, so the shape of every split reads at a glance.
 * Deleting is a two-step inline confirm, offered only to the bill's payer.
 */
export function ExpenseList({
  expenses,
  members,
  currentUser,
  pendingDeleteId,
  onDelete,
  onEdit,
  editingId,
}: ExpenseListProps) {
  const { t, intlLocale } = useI18n();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const dateFormatter = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" });

  function formatDate(value: string | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
  }

  function describeSplit(expense: Expense): string {
    const count = expenseShares(expense).length;
    if (expense.split?.type === "equal") return t("split.equal", { n: count });
    if (expense.split?.type === "exact") return t("split.exact", { n: count });
    return t("split.unknown");
  }

  return (
    <section aria-labelledby="bills-heading" className="rounded-2xl bg-surface shadow-surface">
      <div className="flex items-baseline justify-between px-6 pt-5 pb-3">
        <h2 id="bills-heading" className="text-lg font-bold text-ink">
          {t("bills.title")}
        </h2>
        <span className="text-sm text-ink-3">{countText(t, expenses.length, "household.billsOne", "household.bills")}</span>
      </div>

      {expenses.length === 0 ? (
        <p className="px-6 pb-8 text-sm text-ink-3">{t("bills.empty")}</p>
      ) : (
        <>
          {/* Phones: one stacked row per bill, amount pinned right. */}
          <ul className="border-t border-line sm:hidden">
            {expenses.map((expense) => {
              const shares = expenseShares(expense);
              const isPayer = expense.paid_by === currentUser;
              return (
                <li
                  key={expense.id}
                  aria-current={editingId === expense.id ? "true" : undefined}
                  className="flex gap-3 border-b border-line-soft px-6 py-3 last:border-0 aria-[current]:bg-ok-soft"
                >
                  <MiniCarrier tiers={shares.map((share) => ({ ...share, color: memberColor(members, share.member) }))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-ink">{expense.description}</span>
                      <span className="num shrink-0 font-semibold text-ink">
                        {formatCents(parseSignedCents(expense.amount) ?? 0)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {expense.paid_by}
                      {isPayer ? ` (${t("common.you")})` : ""} · {describeSplit(expense)} ·{" "}
                      <span className="num">{formatDate(expense.created_at)}</span>
                    </p>
                    {isPayer && (
                      <div className="mt-1.5 -ml-2 flex items-center gap-1">
                        <EditButton expense={expense} onEdit={onEdit} hidden={confirmingId === expense.id} />
                        <DeleteControl
                          expense={expense}
                          confirming={confirmingId === expense.id}
                          isDeleting={pendingDeleteId === expense.id}
                          busy={pendingDeleteId !== null}
                          onAsk={() => setConfirmingId(expense.id)}
                          onCancel={() => setConfirmingId(null)}
                          onConfirm={() => {
                            setConfirmingId(null);
                            onDelete(expense.id);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto pb-2 sm:block">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold text-ink-3">
                  <th scope="col" className="w-14 py-2 pr-3 pl-6">
                    <span className="sr-only">{t("bills.colSplit")}</span>
                  </th>
                  <th scope="col" className="py-2 pr-3">{t("bills.colBill")}</th>
                  <th scope="col" className="py-2 pr-3">{t("bills.colPaidBy")}</th>
                  <th scope="col" className="py-2 pr-3">{t("bills.colSplit")}</th>
                  <th scope="col" className="py-2 pr-3">{t("bills.colDate")}</th>
                  <th scope="col" className="py-2 pr-3 text-right">{t("bills.colAmount")}</th>
                  <th scope="col" className="w-36 py-2 pr-6">
                    <span className="sr-only">{t("bills.delete")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const shares = expenseShares(expense);
                  const isPayer = expense.paid_by === currentUser;
                  return (
                    <tr
                      key={expense.id}
                      aria-current={editingId === expense.id ? "true" : undefined}
                      className="border-b border-line-soft last:border-0 hover:bg-ground/60 aria-[current]:bg-ok-soft"
                    >
                      <td className="py-3 pr-3 pl-6">
                        <MiniCarrier
                          tiers={shares.map((share) => ({ ...share, color: memberColor(members, share.member) }))}
                        />
                      </td>
                      <td className="max-w-[16rem] py-3 pr-3">
                        <span className="block truncate font-medium text-ink">{expense.description}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2 whitespace-nowrap text-ink-2">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: memberColor(members, expense.paid_by).fill }}
                          />
                          <span>
                            {expense.paid_by}
                            {isPayer ? <span className="text-ink-3"> ({t("common.you")})</span> : null}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-ink-2">{describeSplit(expense)}</td>
                      <td className="num py-3 pr-3 whitespace-nowrap text-ink-2">{formatDate(expense.created_at)}</td>
                      <td className="num py-3 pr-3 text-right font-semibold whitespace-nowrap text-ink">
                        {formatCents(parseSignedCents(expense.amount) ?? 0)}
                      </td>
                      <td className="py-3 pr-6 text-right whitespace-nowrap">
                        {isPayer && (
                          <span className="inline-flex items-center gap-1">
                            <EditButton expense={expense} onEdit={onEdit} hidden={confirmingId === expense.id} />
                            <DeleteControl
                              expense={expense}
                              confirming={confirmingId === expense.id}
                              isDeleting={pendingDeleteId === expense.id}
                              busy={pendingDeleteId !== null}
                              onAsk={() => setConfirmingId(expense.id)}
                              onCancel={() => setConfirmingId(null)}
                              onConfirm={() => {
                                setConfirmingId(null);
                                onDelete(expense.id);
                              }}
                            />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** Payer-only: opens the bill in the form for editing. */
function EditButton({ expense, onEdit, hidden }: { expense: Expense; onEdit: (expense: Expense) => void; hidden: boolean }) {
  const { t } = useI18n();
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={() => onEdit(expense)}
      aria-label={t("bills.editLabel", { bill: expense.description })}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
    >
      <Icon name="pencil" className="size-3.5" />
      {t("bills.edit")}
    </button>
  );
}

interface DeleteControlProps {
  expense: Expense;
  confirming: boolean;
  isDeleting: boolean;
  /** Another delete is in flight. */
  busy: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Payer-only delete with an inline two-step confirm. */
function DeleteControl({ expense, confirming, isDeleting, busy, onAsk, onCancel, onConfirm }: DeleteControlProps) {
  const { t } = useI18n();
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="sr-only">{t("bills.confirm")}</span>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-negative px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t("bills.confirmYes")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-sunken"
        >
          {t("bills.confirmNo")}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onAsk}
      disabled={busy}
      aria-label={t("bills.deleteLabel", { bill: expense.description })}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-negative-soft hover:text-negative disabled:opacity-50"
    >
      <Icon name="trash" className="size-3.5" />
      {isDeleting ? t("bills.deleting") : t("bills.delete")}
    </button>
  );
}
