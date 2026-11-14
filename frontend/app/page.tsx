"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BalancesPanel } from "@/components/BalancesPanel";
import { Banner } from "@/components/Banner";
import { CreateHousehold } from "@/components/CreateHousehold";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseList } from "@/components/ExpenseList";
import { GroupSettings } from "@/components/GroupSettings";
import { HouseholdRail } from "@/components/HouseholdRail";
import { Icon } from "@/components/Icon";
import {
  ApiError,
  createExpense,
  createGroup,
  deleteExpense,
  deleteGroup,
  fetchBalances,
  fetchExpenses,
  fetchGroup,
  fetchGroups,
  removeMember,
  renameGroup,
  resetInvite,
  updateExpense,
  type BalanceEntry,
  type Expense,
  type ExpensePayload,
  type Group,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { countText, errorText, useI18n, type MessageKey } from "@/lib/i18n";

/**
 * SplitBill's household ledger. Signed-out visitors are sent to /login; a
 * signed-in user gets their households on the rail, the selected household's
 * balances and bills in the centre, and the new-bill panel beside them.
 */
export default function HomePage() {
  const { state, logout, refresh } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/login");
  }, [state.status, router]);

  if (state.status === "signed-in") {
    // Keyed by user so nothing from a previous session survives a switch.
    return <Ledger key={state.user.username} username={state.user.username} onUnauthorized={refresh} onSignOut={logout} />;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-5">
      {state.status === "error" ? (
        <div className="grid max-w-md gap-4 text-center">
          <Banner message={errorText(state.error, t)} />
          <button
            type="button"
            onClick={refresh}
            className="justify-self-center rounded-xl bg-rail px-5 py-2.5 text-sm font-semibold text-rail-text hover:bg-rail-hover"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <p role="status" className="text-sm text-ink-3">
          {t("auth.checking")}
        </p>
      )}
    </div>
  );
}

interface LedgerProps {
  username: string;
  /** A request came back 401: the session is gone. */
  onUnauthorized: () => void;
  onSignOut: () => Promise<void>;
}

type View = "bills" | "settings" | "create";

/** Untranslated notice, so a language switch re-renders it. */
interface Notice {
  key: MessageKey;
  vars?: Record<string, string>;
}

/** The household id in `?group=`, if any (read once, in the browser). */
function groupFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get("group");
  const id = raw === null ? NaN : Number(raw);
  return Number.isInteger(id) ? id : null;
}

/** Keep the open household in the URL so a reload or shared link returns to it. */
function writeGroupToUrl(id: number | null): void {
  window.history.replaceState(null, "", id === null ? "/" : `/?group=${id}`);
}

function Ledger({ username, onUnauthorized, onSignOut }: LedgerProps) {
  const { t } = useI18n();

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsError, setGroupsError] = useState<unknown>(null);
  const [myBalances, setMyBalances] = useState<ReadonlyMap<number, number>>(new Map());

  const [view, setView] = useState<View>("bills");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<unknown>(null);

  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  /* Only the latest household request may update state. */
  const latestGroupRef = useRef<number | null>(null);

  /** Pass a failed request's error through; a 401 also ends the session. */
  const describe = useCallback(
    (error: unknown): unknown => {
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      return error;
    },
    [onUnauthorized],
  );

  const rememberMyBalance = useCallback(
    (id: number, loaded: BalanceEntry[]) => {
      const mine = loaded.find((entry) => entry.member === username)?.cents ?? 0;
      setMyBalances((previous) => new Map(previous).set(id, mine));
    },
    [username],
  );

  /** Open a household's bills. Clears messages unless `keepNotice`. */
  const selectGroup = useCallback(
    (id: number, options: { keepNotice?: boolean; nextView?: View } = {}) => {
      latestGroupRef.current = id;
      writeGroupToUrl(id);
      setGroupId(id);
      setView(options.nextView ?? "bills");
      setEditing(null);
      setGroupLoading(true);
      setGroupError(null);
      setActionError(null);
      if (!options.keepNotice) setNotice(null);
      Promise.all([fetchGroup(id), fetchExpenses(id), fetchBalances(id)])
        .then(([group, loadedExpenses, loadedBalances]) => {
          if (latestGroupRef.current !== id) return;
          setDetail(group);
          setExpenses(loadedExpenses);
          setBalances(loadedBalances);
          rememberMyBalance(id, loadedBalances);
        })
        .catch((error: unknown) => {
          if (latestGroupRef.current === id) setGroupError(describe(error));
        })
        .finally(() => {
          if (latestGroupRef.current === id) setGroupLoading(false);
        });
    },
    [describe, rememberMyBalance],
  );

  /** Open the first household (or the create view when there are none). */
  const openFirst = useCallback(
    (list: Group[], keepNotice = false) => {
      if (list.length > 0) {
        selectGroup(list[0].id, { keepNotice });
      } else {
        latestGroupRef.current = null;
        writeGroupToUrl(null);
        setGroupId(null);
        setDetail(null);
        setView("create");
      }
    },
    [selectGroup],
  );

  useEffect(() => {
    let cancelled = false;
    fetchGroups()
      .then((loaded) => {
        if (cancelled) return;
        setGroups(loaded);
        const wanted = groupFromUrl();
        const match = loaded.find((group) => group.id === wanted);
        if (match) {
          const joined = new URLSearchParams(window.location.search).get("joined") === "1";
          if (joined) setNotice({ key: "notice.joined", vars: { group: match.name } });
          selectGroup(match.id, { keepNotice: joined });
        } else {
          openFirst(loaded);
        }
        // Your standing in every household, for the rail.
        for (const group of loaded) {
          fetchBalances(group.id)
            .then((loadedBalances) => {
              if (!cancelled) rememberMyBalance(group.id, loadedBalances);
            })
            .catch(() => {
              // The rail just omits that figure; the household view reports errors.
            });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setGroupsError(describe(error));
      });
    return () => {
      cancelled = true;
    };
  }, [describe, rememberMyBalance, selectGroup, openFirst]);

  /** Refetch the household after a change; skipped if the user moved on. */
  const refreshGroup = useCallback(
    async (id: number) => {
      const [group, loadedExpenses, loadedBalances] = await Promise.all([
        fetchGroup(id),
        fetchExpenses(id),
        fetchBalances(id),
      ]);
      rememberMyBalance(id, loadedBalances);
      setGroups((previous) => previous?.map((g) => (g.id === id ? group : g)) ?? previous);
      if (latestGroupRef.current !== id) return;
      setDetail(group);
      setExpenses(loadedExpenses);
      setBalances(loadedBalances);
    },
    [rememberMyBalance],
  );

  /** Run a mutation with the shared error/notice handling. */
  const act = useCallback(
    async (action: () => Promise<Notice | null>): Promise<boolean> => {
      setActionError(null);
      setNotice(null);
      try {
        const done = await action();
        if (done) setNotice(done);
        return true;
      } catch (error: unknown) {
        setActionError(describe(error));
        return false;
      }
    },
    [describe],
  );

  const handleSaveBill = useCallback(
    async (payload: ExpensePayload, idempotencyKey: string): Promise<boolean> => {
      if (groupId === null) return false;
      setSubmitting(true);
      try {
        return await act(async () => {
          if (editing) {
            await updateExpense(groupId, editing.id, payload);
          } else {
            await createExpense(groupId, payload, idempotencyKey);
          }
          await refreshGroup(groupId);
          const savedNotice: Notice = { key: editing ? "notice.updated" : "notice.saved" };
          setEditing(null);
          return savedNotice;
        });
      } finally {
        setSubmitting(false);
      }
    },
    [groupId, editing, act, refreshGroup],
  );

  const handleDeleteBill = useCallback(
    async (expenseId: number) => {
      if (groupId === null) return;
      setPendingDeleteId(expenseId);
      await act(async () => {
        await deleteExpense(groupId, expenseId);
        if (editing?.id === expenseId) setEditing(null);
        await refreshGroup(groupId);
        return { key: "notice.deleted" };
      });
      setPendingDeleteId(null);
    },
    [groupId, editing, act, refreshGroup],
  );

  const handleCreateGroup = useCallback(
    (name: string) =>
      act(async () => {
        const group = await createGroup(name);
        setGroups((previous) => [...(previous ?? []), group]);
        setMyBalances((previous) => new Map(previous).set(group.id, 0));
        selectGroup(group.id, { keepNotice: true, nextView: "settings" });
        return { key: "notice.created" };
      }),
    [act, selectGroup],
  );

  const handleRename = useCallback(
    (name: string) =>
      act(async () => {
        if (groupId === null) return null;
        await renameGroup(groupId, name);
        await refreshGroup(groupId);
        return { key: "notice.renamed" };
      }),
    [groupId, act, refreshGroup],
  );

  const handleResetInvite = useCallback(
    () =>
      act(async () => {
        if (groupId === null) return null;
        await resetInvite(groupId);
        await refreshGroup(groupId);
        return { key: "notice.inviteReset" };
      }),
    [groupId, act, refreshGroup],
  );

  /** Remove a member, or leave when `member` is you (then the household disappears). */
  const handleRemoveMember = useCallback(
    (member: string) =>
      act(async (): Promise<Notice | null> => {
        if (groupId === null || detail === null) return null;
        await removeMember(groupId, member);
        if (member !== username) {
          await refreshGroup(groupId);
          return { key: "notice.memberRemoved", vars: { member } };
        }
        const remaining = (groups ?? []).filter((group) => group.id !== groupId);
        setGroups(remaining);
        openFirst(remaining, true);
        return { key: "notice.left", vars: { group: detail.name } };
      }),
    [groupId, detail, username, groups, act, refreshGroup, openFirst],
  );

  const handleDeleteGroup = useCallback(
    () =>
      act(async () => {
        if (groupId === null || detail === null) return null;
        await deleteGroup(groupId);
        const remaining = (groups ?? []).filter((group) => group.id !== groupId);
        setGroups(remaining);
        openFirst(remaining, true);
        return { key: "notice.groupDeleted", vars: { group: detail.name } };
      }),
    [groupId, detail, groups, act, openFirst],
  );

  const handleSignOut = useCallback(() => {
    setSigningOut(true);
    void onSignOut();
  }, [onSignOut]);

  const startEdit = useCallback((expense: Expense) => {
    setEditing(expense);
    setActionError(null);
    setNotice(null);
    // On narrow layouts the form sits above the bills; bring it into view.
    document.getElementById("bill-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const members = detail?.members ?? [];
  const ready = detail !== null && detail.id === groupId && !groupLoading && groupError === null;
  const hasGroups = groups !== null && groups.length > 0;

  const banners = (actionError !== null || notice !== null || groupError !== null) && (
    <div className="grid gap-2" aria-live="polite">
      {groupError !== null && <Banner message={errorText(groupError, t)} />}
      {actionError !== null && (
        <Banner message={errorText(actionError, t)} onDismiss={() => setActionError(null)} />
      )}
      {notice !== null && (
        <Banner tone="success" message={t(notice.key, notice.vars)} onDismiss={() => setNotice(null)} />
      )}
    </div>
  );

  return (
    <div className="min-h-dvh bg-ground lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <HouseholdRail
        username={username}
        groups={groups}
        myBalances={myBalances}
        selectedGroupId={groupId}
        onSelectGroup={(id) => selectGroup(id)}
        onSignOut={handleSignOut}
        signingOut={signingOut}
        onCreateGroup={() => {
          setView("create");
          setActionError(null);
          setNotice(null);
        }}
        creating={view === "create"}
      />

      {groupsError !== null ? (
        <div className="px-5 py-6 sm:px-8 lg:py-8">
          <Banner message={errorText(groupsError, t)} />
        </div>
      ) : view === "create" ? (
        <div className="grid content-start gap-5 px-5 py-6 sm:px-8 lg:py-8">
          {banners}
          <CreateHousehold
            onCreate={handleCreateGroup}
            onCancel={hasGroups ? () => setView("bills") : undefined}
          />
        </div>
      ) : view === "settings" && ready ? (
        <div className="grid max-w-3xl content-start gap-5 px-5 py-6 sm:px-8 lg:py-8">
          {banners}
          <GroupSettings
            key={detail.id}
            group={detail}
            members={members}
            balances={balances}
            currentUser={username}
            onRename={handleRename}
            onResetInvite={handleResetInvite}
            onRemove={handleRemoveMember}
            onDelete={handleDeleteGroup}
            onBack={() => setView("bills")}
          />
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start items-start gap-5 px-5 py-6 sm:px-8 lg:py-8 wide:grid-cols-[minmax(0,1fr)_clamp(21rem,26vw,25rem)] wide:gap-6">
          {/*
            Below `wide` everything is one column: header, banners, balances,
            bill form, bills. At `wide` the ledger becomes its own column and
            the bill panel sits beside it, so neither stretches the other.
          */}
          <div className="contents wide:flex wide:min-w-0 wide:flex-col wide:gap-5">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
                  {detail?.name ?? groups?.find((g) => g.id === groupId)?.name ?? t("common.loading")}
                </h1>
                {ready && (
                  <p className="mt-1 text-sm text-ink-3">
                    {countText(t, members.length, "household.roommatesOne", "household.roommates")} ·{" "}
                    {countText(t, expenses.length, "household.billsOne", "household.bills")}
                  </p>
                )}
              </div>
              {ready && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setView("settings")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-steel-400"
                  >
                    <Icon name="userPlus" className="size-4" />
                    {t("household.invite")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("settings")}
                    aria-label={t("household.settings")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-steel-400"
                  >
                    <Icon name="settings" className="size-4" />
                    <span className="hidden sm:inline">{t("household.settings")}</span>
                  </button>
                </div>
              )}
            </header>

            {banners}

            {groupLoading && (
              <p role="status" className="text-sm text-ink-3">
                {t("common.loading")}
              </p>
            )}

            {ready && <BalancesPanel balances={balances} members={members} currentUser={username} />}

            {ready && (
              <div className="order-2 wide:order-none">
                <ExpenseList
                  expenses={expenses}
                  members={members}
                  currentUser={username}
                  pendingDeleteId={pendingDeleteId}
                  onDelete={handleDeleteBill}
                  onEdit={startEdit}
                  editingId={editing?.id ?? null}
                />
              </div>
            )}
          </div>

          {ready && (
            <section
              id="bill-panel"
              className={`@container order-1 scroll-mt-6 rounded-2xl bg-surface p-6 shadow-raised wide:sticky wide:top-8 wide:order-none ${
                editing ? "ring-2 ring-enamel-jade/40" : ""
              }`}
            >
              {/* Remounted per household and per bill being edited, so the draft resets. */}
              <ExpenseForm
                key={`${groupId}-${editing?.id ?? "new"}`}
                members={members}
                currentUser={username}
                submitting={submitting}
                onSubmit={handleSaveBill}
                editing={editing}
                onCancelEdit={() => setEditing(null)}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
