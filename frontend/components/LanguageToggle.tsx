"use client";

import { useI18n, type Locale } from "@/lib/i18n";

const OPTIONS: { value: Locale; key: "lang.th" | "lang.en"; lang: string }[] = [
  { value: "th", key: "lang.th", lang: "th" },
  { value: "en", key: "lang.en", lang: "en" },
];

/** Thai / English switch. `tone="rail"` sits on the green rail. */
export function LanguageToggle({ tone = "surface" }: { tone?: "surface" | "rail" }) {
  const { locale, setLocale, t } = useI18n();
  const onRail = tone === "rail";
  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={`inline-flex rounded-full p-0.5 text-sm ${onRail ? "bg-rail-hover" : "bg-sunken"}`}
    >
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-pressed={active}
            onClick={() => setLocale(option.value)}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              active
                ? onRail
                  ? "bg-rail-text text-rail"
                  : "bg-surface text-ink shadow-surface"
                : onRail
                  ? "text-rail-muted hover:text-rail-text"
                  : "text-ink-3 hover:text-ink"
            }`}
          >
            {t(option.key)}
          </button>
        );
      })}
    </div>
  );
}
