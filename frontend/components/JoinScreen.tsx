"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { Banner } from "@/components/Banner";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ApiError, joinInvite, previewInvite, type InvitePreview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText, useI18n } from "@/lib/i18n";

type Preview =
  | { status: "loading" }
  | { status: "ready"; invite: InvitePreview }
  | { status: "invalid" }
  | { status: "error"; error: unknown };

/** Shared frame for the join page and its Suspense fallback. */
export function JoinFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-ground px-5 py-6 sm:px-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight text-rail">
          {t("app.name")}
        </Link>
        <LanguageToggle />
      </div>
      <div className="flex flex-1 items-start justify-center py-12 sm:items-center">
        <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-raised sm:p-8">{children}</div>
      </div>
    </div>
  );
}

export function JoinFallback() {
  const { t } = useI18n();
  return (
    <JoinFrame>
      <p role="status" className="text-sm text-ink-3">
        {t("common.loading")}
      </p>
    </JoinFrame>
  );
}

/**
 * Landing page for an invite link. Signed-out visitors go to sign in (and come back
 * here afterwards); members see the household and a Join button.
 */
export function JoinScreen({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { t } = useI18n();
  const { state } = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<unknown>(null);

  const signedIn = state.status === "signed-in";

  useEffect(() => {
    if (state.status === "signed-out") {
      router.replace(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
    }
  }, [state.status, router, code]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    previewInvite(code)
      .then((invite) => {
        if (!cancelled) setPreview({ status: "ready", invite });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const invalid = error instanceof ApiError && error.status === 404;
        setPreview(invalid ? { status: "invalid" } : { status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, code]);

  async function join() {
    setJoining(true);
    setJoinError(null);
    try {
      const group = await joinInvite(code);
      router.replace(`/?group=${group.id}&joined=1`);
    } catch (error: unknown) {
      setJoinError(error);
      setJoining(false);
    }
  }

  if (!signedIn || preview.status === "loading") {
    return (
      <JoinFrame>
        <p role="status" className="text-sm text-ink-3">
          {state.status === "signed-out" ? t("join.signInFirst") : t("common.loading")}
        </p>
      </JoinFrame>
    );
  }

  if (preview.status !== "ready") {
    return (
      <JoinFrame>
        <Banner message={preview.status === "invalid" ? t("join.invalid") : errorText(preview.error, t)} />
        <Link href="/" className="mt-5 inline-block text-sm font-semibold text-enamel-jade hover:underline">
          {t("join.toHome")}
        </Link>
      </JoinFrame>
    );
  }

  const { invite } = preview;
  return (
    <JoinFrame>
      {invite.alreadyMember ? (
        <>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
            {t("join.alreadyMember", { group: invite.name })}
          </h1>
          <Link
            href={`/?group=${invite.groupId}`}
            className="mt-6 inline-block rounded-xl bg-rail px-5 py-2.5 text-[0.9375rem] font-semibold text-rail-text shadow-surface hover:bg-rail-hover"
          >
            {t("join.open")}
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
            {t("join.title", { group: invite.name })}
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
            {t("join.body", { owner: invite.owner, n: invite.memberCount })}
          </p>
          {joinError !== null && (
            <div className="mt-4">
              <Banner message={errorText(joinError, t)} onDismiss={() => setJoinError(null)} />
            </div>
          )}
          <button
            type="button"
            onClick={join}
            disabled={joining}
            className="mt-6 w-full rounded-xl bg-rail px-5 py-3 text-[0.9375rem] font-semibold text-rail-text shadow-surface transition-colors hover:bg-rail-hover disabled:cursor-wait disabled:opacity-70"
          >
            {joining ? t("join.submitting") : t("join.submit")}
          </button>
        </>
      )}
    </JoinFrame>
  );
}
