"use client";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n";

interface BannerProps {
  message: string;
  tone?: "error" | "success";
  onDismiss?: () => void;
}

/**
 * One dismissible banner for every user-facing message: API errors in plain
 * language and success confirmations. Errors use `role="alert"` so screen
 * readers announce them immediately.
 */
export function Banner({ message, tone = "error", onDismiss }: BannerProps) {
  const { t } = useI18n();
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
        isError ? "bg-negative-soft text-negative" : "bg-ok-soft text-positive"
      }`}
    >
      <Icon name={isError ? "alert" : "check"} className="mt-0.5 size-[1.125rem] shrink-0" />
      <p className="flex-1 leading-relaxed">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.dismiss")}
          className="-m-1 shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <Icon name="close" className="size-4" />
        </button>
      )}
    </div>
  );
}
