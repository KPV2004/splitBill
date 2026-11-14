"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { inputClass } from "@/components/ExpenseForm";
import { useI18n } from "@/lib/i18n";

interface CreateHouseholdProps {
  /** Returns true when the household was created. */
  onCreate: (name: string) => Promise<boolean>;
  /** Absent when there is nothing to go back to (no households yet). */
  onCancel?: () => void;
}

/** Name a new household; its creator becomes the owner and can invite roommates next. */
export function CreateHousehold({ onCreate, onCancel }: CreateHouseholdProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const empty = name.trim() === "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (empty) return;
    setSubmitting(true);
    const created = await onCreate(name.trim());
    if (!created) setSubmitting(false);
  }

  return (
    <section className="max-w-xl rounded-2xl bg-surface p-6 shadow-raised sm:p-8">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">{t("create.title")}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{t("create.body")}</p>
      <form onSubmit={handleSubmit} noValidate className="mt-6 grid gap-4">
        <div>
          <label htmlFor="household-name" className="mb-1.5 block text-sm font-semibold text-ink-2">
            {t("create.name")}
          </label>
          <input
            id="household-name"
            value={name}
            maxLength={100}
            autoFocus
            autoComplete="off"
            placeholder={t("create.namePlaceholder")}
            aria-invalid={submitted && empty}
            aria-describedby="household-name-msg"
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
          {submitted && empty && (
            <p id="household-name-msg" className="mt-1.5 text-xs text-negative">
              {t("create.nameRequired")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-rail px-5 py-2.5 text-[0.9375rem] font-semibold text-rail-text shadow-surface transition-colors hover:bg-rail-hover disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? t("create.submitting") : t("create.submit")}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-sunken"
            >
              {t("create.cancel")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
