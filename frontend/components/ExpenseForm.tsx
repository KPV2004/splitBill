"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Carrier, type CarrierTier } from "@/components/Carrier";
import { Icon } from "@/components/Icon";
import type { ExpensePayload } from "@/lib/api";
import { amountErrorText, useI18n } from "@/lib/i18n";
import { memberColor } from "@/lib/members";
import { formatCents, parseAmountCents, serializeCents } from "@/lib/money";
import { computeEqualPreview, computeExactPreview, exactPayloadShares, type SplitType } from "@/lib/split";

interface ExpenseFormProps {
  /** Household members in the order the backend reports them. */
  members: string[];
  currentUser: string;
  submitting: boolean;
  /** Returns true when the bill was recorded (the form then resets). */
  onSubmit: (payload: ExpensePayload, idempotencyKey: string) => Promise<boolean>;
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[0.9375rem] text-ink placeholder:text-ink-3 transition-colors hover:border-steel-400 focus:border-enamel-jade focus:outline-none focus:ring-2 focus:ring-enamel-jade/25 aria-invalid:border-negative aria-invalid:focus:ring-negative/20";

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

/**
 * The new-bill panel: description, amount, payer, and an equal or exact split
 * with the live carrier preview. The preview is derived on every keystroke from
 * lib/split.ts, which follows the backend's split rules exactly, so what the
 * carrier shows is what will be stored. Exact splits stay unsaveable until the
 * shares fill the carrier exactly.
 *
 * Idempotency: one key per draft. A retry of the same payload (e.g. after a
 * timeout) reuses the key, so the backend can never store the bill twice; a
 * changed payload or a successful save gets a fresh key.
 */
export function ExpenseForm({ members, currentUser, submitting, onSubmit }: ExpenseFormProps) {
  const { t } = useI18n();
  const [description, setDescription] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [payer, setPayer] = useState(() => (members.includes(currentUser) ? currentUser : ""));
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(members));
  const [exactRaw, setExactRaw] = useState<Record<string, string>>({});
  const draftRef = useRef<{ key: string; body: string } | null>(null);

  const amount = parseAmountCents(amountRaw);
  const amountValid = amount.ok && amount.cents > 0;
  const totalCents = amount.ok ? amount.cents : 0;

  const equalPreview = computeEqualPreview(totalCents, members, selected);
  const exactPreview = computeExactPreview(totalCents, members, exactRaw);

  const descriptionValid = description.trim().length > 0;
  const payerValid = payer !== "" && members.includes(payer);
  const splitValid = splitType === "equal" ? equalPreview.hasSelection : exactPreview.balanced;
  const canSubmit = !submitting && amountValid && descriptionValid && payerValid && splitValid;

  const tiers: CarrierTier[] =
    splitType === "equal"
      ? equalPreview.selectedMembers.map((member) => ({
          member,
          cents: equalPreview.shares.get(member) ?? 0,
          color: memberColor(members, member),
        }))
      : exactPreview.entries.map((entry) => ({
          member: entry.member,
          cents: entry.cents ?? 0,
          color: memberColor(members, entry.member),
        }));
  const unallocated = exactPreview.unallocatedCents;
  const remainingCents = splitType === "exact" && amountValid ? Math.max(unallocated, 0) : 0;
  const overCents = splitType === "exact" && amountValid ? Math.max(-unallocated, 0) : 0;

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

  function blocker(): string | null {
    if (!descriptionValid) return t("form.needDescription");
    if (!amountValid) return t("form.needAmount");
    if (!payerValid) return t("form.needPayer");
    if (splitType === "equal" && !equalPreview.hasSelection) return t("form.needMember");
    if (splitType === "exact" && !exactPreview.balanced) {
      return exactPreview.invalidMembers.length > 0 ? t("form.fixShares") : t("form.sharesMustAdd");
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !amount.ok) return;
    const payload: ExpensePayload = {
      description: description.trim(),
      paid_by: payer,
      amount: serializeCents(amount.cents),
      split:
        splitType === "equal"
          ? { type: "equal", members: equalPreview.selectedMembers }
          : { type: "exact", shares: exactPayloadShares(exactPreview) },
    };
    const body = JSON.stringify(payload);
    if (draftRef.current === null || draftRef.current.body !== body) {
      draftRef.current = { key: crypto.randomUUID(), body };
    }
    const recorded = await onSubmit(payload, draftRef.current.key);
    if (recorded) {
      draftRef.current = null;
      // Keep payer, split type and selection for quick consecutive entry.
      setDescription("");
      setAmountRaw("");
      setExactRaw({});
    }
  }

  const amountError = amountRaw.trim() !== "" && !amount.ok ? amountErrorText(amount.error, t) : null;
  const pendingBlocker = blocker();

  return (
    <form onSubmit={handleSubmit} aria-labelledby="new-bill-heading" className="flex flex-col gap-5" noValidate>
      <h2 id="new-bill-heading" className="text-xl font-bold text-ink">
        {t("form.title")}
      </h2>

      {/* Two columns when the panel is wide (single-column layouts): inputs left, carrier right. */}
      <div className="grid gap-5 @3xl:grid-cols-2 @3xl:gap-10">
        <div className="flex flex-col gap-5">
          <Field label={t("form.description")} htmlFor="bill-description">
            <input
              id="bill-description"
              type="text"
              value={description}
              maxLength={200}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Field
              label={t("form.amount")}
              htmlFor="bill-amount"
              hint={amountError ? <p className="mt-1.5 text-xs text-negative">{amountError}</p> : null}
            >
              <input
                id="bill-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountRaw}
                aria-invalid={amountError !== null}
                onChange={(event) => setAmountRaw(event.target.value)}
                placeholder="0.00"
                className={`${inputClass} num text-right`}
              />
            </Field>
            <Field label={t("form.paidBy")} htmlFor="bill-payer">
              <div className="relative">
                <select
                  id="bill-payer"
                  value={payer}
                  onChange={(event) => setPayer(event.target.value)}
                  className={`${inputClass} cursor-pointer appearance-none pr-9`}
                >
                  <option value="" disabled>
                    {t("form.selectMember")}
                  </option>
                  {members.map((member) => (
                    <option key={member} value={member}>
                      {member}
                      {member === currentUser ? ` (${t("common.you")})` : ""}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevronDown"
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
                />
              </div>
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink-2">{t("form.splitType")}</legend>
            <div className="grid grid-cols-2 rounded-xl bg-sunken p-1 text-sm">
              {(["equal", "exact"] as const).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-center font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-enamel-jade ${
                    splitType === value ? "bg-surface text-ink shadow-surface" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="split-type"
                    value={value}
                    checked={splitType === value}
                    onChange={() => setSplitType(value)}
                    className="sr-only"
                  />
                  {value === "equal" ? t("form.equal") : t("form.exact")}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex gap-4">
            <Carrier
              tiers={tiers}
              remainingCents={remainingCents}
              overCents={overCents}
              empty={!amountValid}
              ghosts={(splitType === "equal" ? equalPreview.selectedMembers : members).map((member) =>
                memberColor(members, member),
              )}
            />

            <fieldset className="min-w-0 flex-1 pt-7">
              <legend className="sr-only">{splitType === "equal" ? t("form.splitBetween") : t("form.exact")}</legend>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {members.map((member) => {
                  const color = memberColor(members, member);
                  const isPayer = member === payer;
                  if (splitType === "equal") {
                    const included = selected.has(member);
                    const share = equalPreview.shares.get(member);
                    return (
                      <li key={member}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sunken">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggleMember(member)}
                            className="size-4 shrink-0 accent-enamel-jade"
                          />
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.fill }} />
                          <span className={`min-w-0 flex-1 truncate ${included ? "text-ink" : "text-ink-3"}`}>
                            {member}
                            {isPayer ? <span className="text-ink-3"> · {t("form.paid")}</span> : null}
                          </span>
                          <span className="num text-right font-semibold text-ink">
                            {!included ? (
                              <span className="text-xs font-normal text-ink-3">{t("form.notIncluded")}</span>
                            ) : amountValid && share !== undefined ? (
                              formatCents(share)
                            ) : (
                              "—"
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  }
                  const entry = exactPreview.entries.find((candidate) => candidate.member === member);
                  const invalid = entry !== undefined && entry.cents === null && !entry.blank;
                  return (
                    <li key={member} className="flex items-center gap-2.5 px-2 py-0.5 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.fill }} />
                      <label htmlFor={`share-${member}`} className="min-w-0 flex-1 truncate text-ink">
                        <span className="sr-only">{t("form.shareFor", { member })}</span>
                        <span aria-hidden="true">{member}</span>
                      </label>
                      <input
                        id={`share-${member}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={entry?.raw ?? ""}
                        aria-invalid={invalid}
                        onChange={(event) =>
                          setExactRaw((previous) => ({ ...previous, [member]: event.target.value }))
                        }
                        className={`${inputClass.replace("w-full", "w-24")} num shrink-0 py-1.5 text-right`}
                      />
                    </li>
                  );
                })}
              </ul>
              {splitType === "equal" && (
                <div className="mt-2 flex gap-3 px-2 text-xs">
                  <button type="button" className="font-medium text-enamel-jade hover:underline" onClick={() => setSelected(new Set(members))}>
                    {t("form.selectAll")}
                  </button>
                  <button type="button" className="font-medium text-ink-3 hover:text-ink hover:underline" onClick={() => setSelected(new Set())}>
                    {t("form.clear")}
                  </button>
                </div>
              )}
            </fieldset>
          </div>

          <div aria-live="polite" className="min-h-[2.75rem]">
            {!amountValid ? (
              <p className="text-sm text-ink-3">{t("form.previewEmpty")}</p>
            ) : splitType === "exact" ? (
              <p
                className={`rounded-xl px-3.5 py-2.5 text-sm ${
                  unallocated === 0
                    ? "bg-ok-soft text-positive"
                    : unallocated > 0
                      ? "bg-warn-soft text-warn"
                      : "bg-negative-soft text-negative"
                }`}
              >
                {unallocated > 0
                  ? t("form.remaining", { amount: formatCents(unallocated) })
                  : unallocated < 0
                    ? t("form.over", { amount: formatCents(-unallocated) })
                    : t("form.balanced")}
              </p>
            ) : (
              <p className="flex justify-between text-sm text-ink-2">
                <span>{t("form.total")}</span>
                <span className="num font-semibold text-ink">{formatCents(totalCents)}</span>
              </p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-rail px-4 py-3 text-[0.9375rem] font-semibold text-rail-text shadow-surface transition-colors hover:bg-rail-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 disabled:shadow-none"
            >
              {submitting ? t("form.submitting") : t("form.submit")}
            </button>
            {!submitting && pendingBlocker !== null && (
              <p className="mt-2 text-center text-xs text-ink-3">{pendingBlocker}</p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
