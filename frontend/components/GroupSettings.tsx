"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { inputClass } from "@/components/ExpenseForm";
import { Icon } from "@/components/Icon";
import type { BalanceEntry, Group } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { memberColor } from "@/lib/members";
import { formatCents } from "@/lib/money";

interface GroupSettingsProps {
  group: Group;
  members: string[];
  balances: BalanceEntry[];
  currentUser: string;
  /** Each returns true on success. Errors are reported by the page. */
  onRename: (name: string) => Promise<boolean>;
  onResetInvite: () => Promise<boolean>;
  onRemove: (member: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onBack: () => void;
}

function Section({ title, children, tone }: { title: string; children: ReactNode; tone?: "danger" }) {
  return (
    <section
      className={`rounded-2xl bg-surface p-6 shadow-surface ${tone === "danger" ? "ring-1 ring-negative/30" : ""}`}
    >
      <h2 className={`text-lg font-bold ${tone === "danger" ? "text-negative" : "text-ink"}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const secondaryButton =
  "inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-steel-400 disabled:opacity-60";
const primaryButton =
  "rounded-xl bg-rail px-4 py-2.5 text-sm font-semibold text-rail-text shadow-surface transition-colors hover:bg-rail-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 disabled:shadow-none";

/**
 * A household's settings. Everyone sees the invite link, the members and their own
 * "Leave"; only the owner can rename, reset the link, remove members and delete. Members
 * with a non-zero balance can't leave or be removed — the button explains why.
 */
export function GroupSettings({
  group,
  members,
  balances,
  currentUser,
  onRename,
  onResetInvite,
  onRemove,
  onDelete,
  onBack,
}: GroupSettingsProps) {
  const { t } = useI18n();
  const isOwner = group.owner === currentUser;
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");

  const inviteLink =
    group.inviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/join/${group.inviteCode}`
      : "";
  const balanceOf = (member: string) => balances.find((entry) => entry.member === member)?.cents ?? 0;

  async function run(key: string, action: () => Promise<boolean>) {
    setBusy(key);
    try {
      return await action();
    } finally {
      setBusy(null);
    }
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === "" || name.trim() === group.name) return;
    await run("rename", () => onRename(name.trim()));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays selectable in the field.
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" />
          {t("household.backToBills")}
        </button>
        <h1 className="mt-3 text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
          {t("settings.title")}
        </h1>
      </div>

      <Section title={t("settings.name")}>
        {isOwner ? (
          <form onSubmit={handleRename} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="group-name" className="sr-only">
              {t("settings.name")}
            </label>
            <input
              id="group-name"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={busy !== null || name.trim() === "" || name.trim() === group.name}
              className={`${primaryButton} shrink-0`}
            >
              {busy === "rename" ? t("settings.saving") : t("settings.saveName")}
            </button>
          </form>
        ) : (
          <>
            <p className="text-[0.9375rem] font-semibold text-ink">{group.name}</p>
            <p className="mt-1 text-sm text-ink-3">{t("settings.ownerOnlyName", { owner: group.owner ?? "" })}</p>
          </>
        )}
      </Section>

      <Section title={t("settings.inviteTitle")}>
        <p className="text-sm text-ink-2">{t("settings.inviteBody")}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="invite-link" className="sr-only">
            {t("settings.inviteTitle")}
          </label>
          <input
            id="invite-link"
            readOnly
            value={inviteLink}
            onFocus={(event) => event.currentTarget.select()}
            className={`${inputClass} bg-ground font-medium`}
          />
          <button type="button" onClick={copyLink} className={`${secondaryButton} shrink-0 justify-center`}>
            <Icon name={copied ? "check" : "copy"} className="size-4" />
            {copied ? t("settings.copied") : t("settings.copy")}
          </button>
        </div>
        {isOwner && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("reset", onResetInvite)}
              className="text-sm font-semibold text-enamel-jade hover:underline disabled:opacity-60"
            >
              {t("settings.resetInvite")}
            </button>
            <span className="text-xs text-ink-3">{t("settings.resetInviteBody")}</span>
          </div>
        )}
      </Section>

      <Section title={t("settings.membersTitle")}>
        <ul className="grid gap-1">
          {members.map((member) => {
            const color = memberColor(members, member);
            const cents = balanceOf(member);
            const settled = cents === 0;
            const isSelf = member === currentUser;
            const isMemberOwner = member === group.owner;
            const canAct = !isMemberOwner && (isSelf || isOwner);
            const confirmKey = `remove:${member}`;
            return (
              <li
                key={member}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-ground"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.fill }} />
                  <span className="truncate font-medium text-ink">
                    {member}
                    {isSelf ? <span className="font-normal text-ink-3"> ({t("common.you")})</span> : null}
                  </span>
                  {isMemberOwner && (
                    <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-2">
                      {t("settings.owner")}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="num text-sm text-ink-2">
                    {cents > 0 ? "+" : cents < 0 ? "−" : ""}
                    {formatCents(Math.abs(cents))}
                  </span>
                  {canAct &&
                    (confirming === confirmKey ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs text-ink-2">
                          {isSelf
                            ? t("settings.leaveConfirm", { group: group.name })
                            : t("settings.removeConfirm", { member })}
                        </span>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={async () => {
                            const done = await run(confirmKey, () => onRemove(member));
                            if (!done) setConfirming(null);
                          }}
                          className="rounded-lg bg-negative px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                        >
                          {t("settings.confirmYes")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-sunken"
                        >
                          {t("settings.confirmNo")}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!settled || busy !== null}
                        title={settled ? undefined : t("settings.settledRule")}
                        onClick={() => setConfirming(confirmKey)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-negative-soft hover:text-negative disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink-3"
                      >
                        {isSelf ? t("settings.leave") : t("settings.remove")}
                      </button>
                    ))}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-ink-3">{t("settings.settledRule")}</p>
      </Section>

      {isOwner && (
        <Section title={t("settings.dangerTitle")} tone="danger">
          <p className="text-sm text-ink-2">{t("settings.dangerBody")}</p>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (deleteText === group.name) void run("delete", onDelete);
            }}
          >
            <div className="flex-1">
              <label htmlFor="delete-confirm" className="mb-1.5 block text-sm font-semibold text-ink-2">
                {t("settings.dangerConfirmLabel", { group: group.name })}
              </label>
              <input
                id="delete-confirm"
                value={deleteText}
                autoComplete="off"
                onChange={(event) => setDeleteText(event.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={deleteText !== group.name || busy !== null}
              className="shrink-0 rounded-xl bg-negative px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === "delete" ? t("settings.deleting") : t("settings.delete")}
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}
