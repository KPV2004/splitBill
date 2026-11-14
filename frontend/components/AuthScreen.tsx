"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Banner } from "@/components/Banner";
import { Carrier } from "@/components/Carrier";
import { inputClass } from "@/components/ExpenseForm";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN, useAuth } from "@/lib/auth";
import { errorText, useI18n, type MessageKey } from "@/lib/i18n";
import { MEMBER_COLORS } from "@/lib/members";
import { equalSplitCents, formatCents } from "@/lib/money";

type Mode = "login" | "register";

/** The golden example: 1,000.00 three ways → 333.34 / 333.33 / 333.33. */
const SHOWCASE_MEMBERS = ["alice", "bob", "carol"];
const SHOWCASE_SHARES = equalSplitCents(100000, SHOWCASE_MEMBERS.length);

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-3 transition-colors hover:text-ink"
      >
        <Icon name={visible ? "eyeOff" : "eye"} className="size-[1.125rem]" />
      </button>
    </div>
  );
}

function FieldMessage({ id, error, hint }: { id: string; error: string | null; hint?: string }) {
  if (error) {
    return (
      <p id={id} className="mt-1.5 text-xs text-negative">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={id} className="mt-1.5 text-xs text-ink-3">
        {hint}
      </p>
    );
  }
  return null;
}

function Showcase() {
  const { t } = useI18n();
  return (
    <div className="@container flex items-end gap-6">
      <Carrier
        tiers={SHOWCASE_MEMBERS.map((member, index) => ({
          member,
          cents: SHOWCASE_SHARES[index] ?? 0,
          color: MEMBER_COLORS[index] ?? MEMBER_COLORS[0],
        }))}
      />
      <div className="max-w-[17rem] pb-1">
        <p className="font-semibold text-rail-text">{t("auth.showcaseCaption")}</p>
        <ul className="mt-3 grid gap-1.5 text-sm">
          {SHOWCASE_MEMBERS.map((member, index) => (
            <li key={member} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-rail-muted">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: MEMBER_COLORS[index]?.fill }} />
                {member}
              </span>
              <span className="num font-semibold text-rail-text">{formatCents(SHOWCASE_SHARES[index] ?? 0)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-rail-muted">{t("auth.showcaseNote")}</p>
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="rail hidden flex-col justify-between bg-rail px-12 py-12 text-rail-text lg:flex xl:px-16">
        <span className="text-[1.375rem] font-bold tracking-tight">{t("app.name")}</span>
        <div>
          <p className="max-w-[26rem] text-[2.5rem] leading-[1.2] font-bold tracking-tight text-balance">
            {t("app.tagline")}
          </p>
          <div className="mt-12">
            <Showcase />
          </div>
        </div>
        <span aria-hidden="true" />
      </aside>
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-rail lg:invisible">{t("app.name")}</span>
          <LanguageToggle />
        </div>
        {/* Narrow screens: the promise and the carrier, laid on its side. */}
        <div className="rail mt-6 rounded-2xl bg-rail px-5 py-5 text-rail-text lg:hidden">
          <p className="text-lg leading-snug font-bold text-balance">{t("app.tagline")}</p>
          <div className="mt-4 flex h-9 gap-1 rounded-xl bg-rail-hover p-1" aria-hidden="true">
            {SHOWCASE_MEMBERS.map((member, index) => (
              <div
                key={member}
                className="num flex flex-1 items-center justify-center rounded-lg text-xs font-semibold"
                style={{ backgroundColor: MEMBER_COLORS[index]?.fill, color: MEMBER_COLORS[index]?.on }}
              >
                {formatCents(SHOWCASE_SHARES[index] ?? 0)}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-rail-muted">{t("auth.showcaseCaption")}</p>
        </div>
        <div className="flex flex-1 items-start justify-center py-10 lg:items-center">
          <div className="w-full max-w-[25rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/**
 * Sign-in and account-creation screens. Validation mirrors the backend's rules
 * so most mistakes are caught before a request; the backend's own message is
 * shown when it still rejects. Signed-in visitors are sent straight to the app.
 */
export function AuthScreen({ mode }: { mode: Mode }) {
  const { t } = useI18n();
  const { state, login, register } = useAuth();
  const router = useRouter();
  const ids = useId();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "signed-in") router.replace("/");
  }, [state.status, router]);

  const isRegister = mode === "register";
  const name = username.trim();

  function usernameError(): MessageKey | null {
    if (name === "") return "auth.usernameRequired";
    if (isRegister && !USERNAME_PATTERN.test(name)) return "auth.usernameInvalid";
    return null;
  }
  function passwordError(): MessageKey | null {
    if (password === "") return "auth.passwordRequired";
    if (isRegister && password.length < MIN_PASSWORD_LENGTH) return "auth.passwordShort";
    return null;
  }
  function confirmError(): MessageKey | null {
    if (!isRegister) return null;
    return confirm !== password ? "auth.passwordMismatch" : null;
  }

  const errors = {
    username: submitted ? usernameError() : null,
    password: submitted ? passwordError() : null,
    confirm: submitted ? confirmError() : null,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (usernameError() || passwordError() || confirmError()) return;
    setSubmitting(true);
    try {
      const credentials = { username: name, password };
      await (isRegister ? register(credentials) : login(credentials));
      router.replace("/");
    } catch (error: unknown) {
      setServerError(errorText(error, t));
      setSubmitting(false);
    }
  }

  const title = isRegister ? t("register.title") : t("login.title");

  return (
    <Frame>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-[0.9375rem] text-ink-2">
        {isRegister ? t("register.subtitle") : t("login.subtitle")}
      </p>

      {state.status === "loading" || state.status === "signed-in" ? (
        <p role="status" className="mt-8 text-sm text-ink-3">
          {t("auth.checking")}
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-5">
          {serverError !== null && <Banner message={serverError} onDismiss={() => setServerError(null)} />}

          <div>
            <label htmlFor={`${ids}-username`} className="mb-1.5 block text-sm font-semibold text-ink-2">
              {t("auth.username")}
            </label>
            <input
              id={`${ids}-username`}
              type="text"
              value={username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={errors.username !== null}
              aria-describedby={`${ids}-username-msg`}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
            />
            <FieldMessage
              id={`${ids}-username-msg`}
              error={errors.username ? t(errors.username) : null}
              hint={isRegister ? t("auth.usernameHint") : undefined}
            />
          </div>

          <div>
            <label htmlFor={`${ids}-password`} className="mb-1.5 block text-sm font-semibold text-ink-2">
              {t("auth.password")}
            </label>
            <PasswordInput
              id={`${ids}-password`}
              value={password}
              onChange={setPassword}
              autoComplete={isRegister ? "new-password" : "current-password"}
              invalid={errors.password !== null}
              describedBy={`${ids}-password-msg`}
            />
            <FieldMessage
              id={`${ids}-password-msg`}
              error={errors.password ? t(errors.password) : null}
              hint={isRegister ? t("auth.passwordHint") : undefined}
            />
          </div>

          {isRegister && (
            <div>
              <label htmlFor={`${ids}-confirm`} className="mb-1.5 block text-sm font-semibold text-ink-2">
                {t("auth.confirmPassword")}
              </label>
              <PasswordInput
                id={`${ids}-confirm`}
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                invalid={errors.confirm !== null}
                describedBy={`${ids}-confirm-msg`}
              />
              <FieldMessage id={`${ids}-confirm-msg`} error={errors.confirm ? t(errors.confirm) : null} />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-xl bg-rail px-4 py-3 text-[0.9375rem] font-semibold text-rail-text shadow-surface transition-colors hover:bg-rail-hover disabled:cursor-wait disabled:opacity-70"
          >
            {submitting
              ? isRegister
                ? t("register.submitting")
                : t("login.submitting")
              : isRegister
                ? t("register.submit")
                : t("login.submit")}
          </button>

          <p className="text-center text-sm text-ink-2">
            {isRegister ? t("register.haveAccount") : t("login.noAccount")}{" "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-semibold text-enamel-jade underline decoration-enamel-jade/40 hover:decoration-enamel-jade"
            >
              {isRegister ? t("register.toLogin") : t("login.toRegister")}
            </Link>
          </p>
        </form>
      )}
    </Frame>
  );
}
