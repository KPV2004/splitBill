interface ErrorBannerProps {
  message: string;
  tone?: "error" | "success";
  onDismiss: () => void;
}

/**
 * One dismissible banner for every user-facing message: API errors in plain
 * language and success confirmations. `role="alert"` makes screen readers
 * announce errors immediately.
 */
export function Banner({ message, tone = "error", onDismiss }: ErrorBannerProps) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        isError
          ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
          : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
      }`}
    >
      <p className="leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={isError ? "Dismiss error" : "Dismiss message"}
        className="shrink-0 rounded p-1 leading-none opacity-60 transition hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: Omit<ErrorBannerProps, "tone">) {
  return <Banner message={message} tone="error" onDismiss={onDismiss} />;
}

export function SuccessBanner({ message, onDismiss }: Omit<ErrorBannerProps, "tone">) {
  return <Banner message={message} tone="success" onDismiss={onDismiss} />;
}
