"use client";

import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { Group } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatCents } from "@/lib/money";

interface HouseholdRailProps {
  username: string;
  groups: Group[] | null;
  /** Your balance per household id, in cents, when loaded. */
  myBalances: ReadonlyMap<number, number>;
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number) => void;
  onSignOut: () => void;
  signingOut: boolean;
}

function signed(cents: number): string {
  if (cents > 0) return `+${formatCents(cents)}`;
  if (cents < 0) return `−${formatCents(-cents)}`;
  return formatCents(0);
}

/**
 * The enamel-green rail: your households with where you stand in each, and
 * your account at the foot. On narrow screens it becomes a top bar.
 */
export function HouseholdRail({
  username,
  groups,
  myBalances,
  selectedGroupId,
  onSelectGroup,
  onSignOut,
  signingOut,
}: HouseholdRailProps) {
  const { t } = useI18n();

  return (
    <aside className="rail flex flex-col bg-rail text-rail-text lg:sticky lg:top-0 lg:h-dvh">
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4 lg:px-6 lg:pt-7 lg:pb-6">
        <span className="text-[1.375rem] font-bold tracking-tight">{t("app.name")}</span>
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageToggle tone="rail" />
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            aria-label={`${t("rail.signOut")} (${username})`}
            className="rounded-lg p-2 text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-text disabled:opacity-60"
          >
            <Icon name="logout" className="size-5" />
          </button>
        </div>
      </div>

      <nav aria-labelledby="households-heading" className="px-3 pb-3 lg:flex-1 lg:overflow-y-auto">
        <h2 id="households-heading" className="mb-1.5 px-3 text-sm font-semibold text-rail-muted">
          {t("rail.households")}
        </h2>
        {groups === null ? (
          <p className="px-3 py-2 text-sm text-rail-muted">{t("common.loading")}</p>
        ) : (
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {groups.map((group) => {
              const active = group.id === selectedGroupId;
              const balance = myBalances.get(group.id);
              return (
                <li key={group.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectGroup(group.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left text-[0.9375rem] transition-colors ${
                      active ? "bg-rail-active font-semibold text-white" : "text-rail-text hover:bg-rail-hover"
                    }`}
                  >
                    <span className="truncate">{group.name}</span>
                    {balance !== undefined && (
                      <span className="num shrink-0 text-sm font-normal text-rail-muted">{signed(balance)}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="hidden border-t border-rail-line px-6 py-5 lg:grid lg:gap-4">
        <div>
          <LanguageToggle tone="rail" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs whitespace-nowrap text-rail-muted">{t("rail.signedInAs")}</p>
            <p className="truncate font-semibold">{username}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-text disabled:opacity-60"
          >
            <Icon name="logout" className="size-4" />
            {signingOut ? t("rail.signingOut") : t("rail.signOut")}
          </button>
        </div>
      </div>
    </aside>
  );
}
