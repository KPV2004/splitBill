"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BalancesPanel } from "@/components/BalancesPanel";
import { Banner } from "@/components/Banner";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseList } from "@/components/ExpenseList";
import { HouseholdRail } from "@/components/HouseholdRail";
import {
  ApiError,
  createExpense,
  deleteExpense,
  fetchBalances,
  fetchExpenses,
  fetchGroup,
  fetchGroups,
  type BalanceEntry,
  type Expense,
  type ExpensePayload,
  type Group,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText, useI18n } from "@/lib/i18n";

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

function Ledger({ username, onUnauthorized, onSignOut }: LedgerProps) {
  const { t } = useI18n();

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsError, setGroupsError] = useState<unknown>(null);
  const [myBalances, setMyBalances] = useState<ReadonlyMap<number, number>>(new Map());

  const [groupId, setGroupId] = useState<number | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<unknown>(null);

  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  // Errors and notices are kept untranslated so a language switch re-renders them.
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<"notice.saved" | "notice.deleted" | null>(null);
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

  const selectGroup = useCallback(
    (id: number) => {
      latestGroupRef.current = id;
      setGroupId(id);
      setGroupLoading(true);
      setGroupError(null);
      setActionError(null);
      setNotice(null);
      Promise.all([fetchGroup(id), fetchExpenses(id), fetchBalances(id)])
        .then(([group, loadedExpenses, loadedBalances]) => {
          if (latestGroupRef.current !== id) return;
          setMembers(group.members ?? []);
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

  useEffect(() => {
    let cancelled = false;
    fetchGroups()
      .then((loaded) => {
        if (cancelled) return;
        setGroups(loaded);
        if (loaded.length > 0) selectGroup(loaded[0].id);
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
  }, [describe, rememberMyBalance, selectGroup]);

  /** Refetch bills + balances after a change; skipped if the user moved on. */
  const refreshGroup = useCallback(
    async (id: number) => {
      const [loadedExpenses, loadedBalances] = await Promise.all([fetchExpenses(id), fetchBalances(id)]);
      rememberMyBalance(id, loadedBalances);
      if (latestGroupRef.current !== id) return;
      setExpenses(loadedExpenses);
      setBalances(loadedBalances);
    },
    [rememberMyBalance],
  );

  const handleCreate = useCallback(
    async (payload: ExpensePayload, idempotencyKey: string): Promise<boolean> => {
      if (groupId === null) return false;
      setSubmitting(true);
      setActionError(null);
      setNotice(null);
      try {
        await createExpense(groupId, payload, idempotencyKey);
        await refreshGroup(groupId);
        setNotice("notice.saved");
        return true;
      } catch (error: unknown) {
        setActionError(describe(error));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [groupId, refreshGroup, describe],
  );

  const handleDelete = useCallback(
    async (expenseId: number) => {
      if (groupId === null) return;
      setPendingDeleteId(expenseId);
      setActionError(null);
      setNotice(null);
      try {
        await deleteExpense(groupId, expenseId);
        await refreshGroup(groupId);
        setNotice("notice.deleted");
      } catch (error: unknown) {
        setActionError(describe(error));
      } finally {
        setPendingDeleteId(null);
      }
    },
    [groupId, refreshGroup, describe],
  );

  const handleSignOut = useCallback(() => {
    setSigningOut(true);
    void onSignOut();
  }, [onSignOut]);

  const group = groups?.find((candidate) => candidate.id === groupId) ?? null;
  const ready = group !== null && !groupLoading && groupError === null;

  return (
    <div className="min-h-dvh bg-ground lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <HouseholdRail
        username={username}
        groups={groups}
        myBalances={myBalances}
        selectedGroupId={groupId}
        onSelectGroup={selectGroup}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start items-start gap-5 px-5 py-6 sm:px-8 lg:py-8 wide:grid-cols-[minmax(0,1fr)_clamp(21rem,26vw,25rem)] wide:gap-6">
        {groupsError !== null ? (
          <div className="wide:col-span-2">
            <Banner message={errorText(groupsError, t)} />
          </div>
        ) : groups !== null && groups.length === 0 ? (
          <section className="max-w-xl rounded-2xl bg-surface p-8 shadow-surface wide:col-span-2">
            <h1 className="text-xl font-bold text-ink">{t("home.noHouseholdsTitle")}</h1>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{t("home.noHouseholdsBody")}</p>
          </section>
        ) : (
          <>
            {/*
              Below `wide` everything is one column: header, banners, balances,
              new bill, bills. At `wide` the ledger becomes its own column and
              the new-bill panel sits beside it, so neither stretches the other.
            */}
            <div className="contents wide:flex wide:min-w-0 wide:flex-col wide:gap-5">
              <header>
                <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
                  {group?.name ?? t("common.loading")}
                </h1>
                {ready && (
                  <p className="mt-1 text-sm text-ink-3">
                    {t("household.roommates", { n: members.length })} · {t("household.bills", { n: expenses.length })}
                  </p>
                )}
              </header>

              {(actionError !== null || notice !== null || groupError !== null) && (
                <div className="grid gap-2" aria-live="polite">
                  {groupError !== null && <Banner message={errorText(groupError, t)} />}
                  {actionError !== null && (
                    <Banner message={errorText(actionError, t)} onDismiss={() => setActionError(null)} />
                  )}
                  {notice !== null && <Banner tone="success" message={t(notice)} onDismiss={() => setNotice(null)} />}
                </div>
              )}

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
                    onDelete={handleDelete}
                  />
                </div>
              )}
            </div>

            {ready && (
              <section className="@container order-1 rounded-2xl bg-surface p-6 shadow-raised wide:sticky wide:top-8 wide:order-none">
                {/* Remounted per household so the draft resets on switch. */}
                <ExpenseForm
                  key={groupId}
                  members={members}
                  currentUser={username}
                  submitting={submitting}
                  onSubmit={handleCreate}
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
