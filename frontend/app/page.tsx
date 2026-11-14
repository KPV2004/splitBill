"use client";

import { useCallback, useRef, useState } from "react";

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
import { ErrorBanner, SuccessBanner } from "@/components/Banner";
import { UserGroupPicker } from "@/components/UserGroupPicker";
import { ExpenseForm } from "@/components/ExpenseForm";
import { BalancesPanel } from "@/components/BalancesPanel";
import { ExpenseList } from "@/components/ExpenseList";

/** Plain-language message for anything thrown during a request. */
function toMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Stable key identifying "data for this user+group", used by stale-response guards. */
function groupRequestKey(user: string, id: number): string {
  return `${user}:${id}`;
}

/**
 * SplitBill — a single page implementing the split-bill flow against the
 * backend API (backend/README.md):
 *
 * 1. user + group selection (only the selected user's groups are listed),
 * 2. expense entry with equal/exact splits,
 * 3. live split preview (lib/split.ts mirrors the backend exactly),
 * 4. plain-language API error handling,
 * 5. balances + expense list.
 *
 * The page is fully event-driven: every fetch starts from a user action
 * (show groups, pick a group, add/delete an expense), and stale responses are
 * discarded with sequence guards. All requests go through a same-origin
 * rewrite (`/api/*` → backend, see next.config.ts) carrying the `X-User`
 * header; expense creation also sends a fresh `Idempotency-Key` per attempt.
 */
export default function HomePage() {
  /* --- user & groups --- */
  const [userInput, setUserInput] = useState("");
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [knownUsers, setKnownUsers] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  /* --- selected group --- */
  const [groupId, setGroupId] = useState<number | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  /* --- mutations --- */
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* Sequence guards: only the latest user/group request may update state.
     Keys are `${user}:${groupId}` strings so guards compare by value. */
  const latestUserRequestRef = useRef<string | null>(null);
  const latestGroupRequestRef = useRef<string | null>(null);

  /* Requirement 1: user + group selection — the API lists only the groups of
     the user sent in the X-User header, so only those are shown. */
  const loadUser = useCallback(() => {
    const name = userInput.trim();
    if (name === "") {
      setActionError("Enter a user name first — the API identifies you by that name.");
      return;
    }
    setActionError(null);
    setNotice(null);
    setKnownUsers((previous) => (previous.includes(name) ? previous : [...previous, name]));
    setActiveUser(name);
    setGroups(null);
    setGroupId(null);
    setGroupsError(null);
    setGroupError(null);
    setGroupsLoading(true);
    latestUserRequestRef.current = name;
    fetchGroups(name)
      .then((loaded) => {
        if (latestUserRequestRef.current !== name) return; // stale response
        setGroups(loaded);
        setGroupsLoading(false);
      })
      .catch((error: unknown) => {
        if (latestUserRequestRef.current !== name) return;
        setGroupsError(toMessage(error, "Could not load your groups."));
        setGroupsLoading(false);
      });
  }, [userInput]);

  const selectGroup = useCallback(
    (id: number) => {
      if (activeUser === null) return;
      setGroupId(id);
      setMembers([]);
      setExpenses([]);
      setBalances([]);
      setGroupError(null);
      setActionError(null);
      setNotice(null);
      setGroupLoading(true);
      const requestKey = groupRequestKey(activeUser, id);
      latestGroupRequestRef.current = requestKey;
      const loadDetail = fetchGroup(activeUser, id)
        .then((group) => {
          if (latestGroupRequestRef.current !== requestKey) return;
          setMembers(group.members ?? []);
        })
        .catch((error: unknown) => {
          if (latestGroupRequestRef.current !== requestKey) return;
          setGroupError(toMessage(error, "Could not load this group."));
        });
      const loadLists = Promise.all([fetchExpenses(activeUser, id), fetchBalances(activeUser, id)])
        .then(([loadedExpenses, loadedBalances]) => {
          if (latestGroupRequestRef.current !== requestKey) return;
          setExpenses(loadedExpenses);
          setBalances(loadedBalances);
        })
        .catch((error: unknown) => {
          if (latestGroupRequestRef.current !== requestKey) return;
          setGroupError(toMessage(error, "Could not load expenses and balances for this group."));
        });
      Promise.all([loadDetail, loadLists]).finally(() => {
        if (latestGroupRequestRef.current === requestKey) setGroupLoading(false);
      });
    },
    [activeUser],
  );

  /* Refetch expenses + balances after a successful mutation. Returns false
     when the user has since switched group (response would be stale). */
  const refreshGroupData = useCallback(async (user: string, id: number): Promise<boolean> => {
    const requestKey = groupRequestKey(user, id);
    const [loadedExpenses, loadedBalances] = await Promise.all([fetchExpenses(user, id), fetchBalances(user, id)]);
    if (latestGroupRequestRef.current !== requestKey) return false;
    setExpenses(loadedExpenses);
    setBalances(loadedBalances);
    return true;
  }, []);

  /* Requirement 4: API errors surface in plain language via the banner. */
  const handleCreateExpense = useCallback(
    async (payload: ExpensePayload): Promise<boolean> => {
      if (activeUser === null || groupId === null) return false;
      setSubmitting(true);
      setActionError(null);
      setNotice(null);
      try {
        // Fresh idempotency key per submission attempt (AI_NOTES.md §4.6):
        // a retried click never silently duplicates an expense.
        await createExpense(activeUser, groupId, payload, crypto.randomUUID());
        await refreshGroupData(activeUser, groupId);
        setNotice("Expense recorded.");
        return true;
      } catch (error: unknown) {
        setActionError(toMessage(error));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [activeUser, groupId, refreshGroupData],
  );

  const handleDeleteExpense = useCallback(
    async (expenseId: number): Promise<void> => {
      if (activeUser === null || groupId === null) return;
      setPendingDeleteId(expenseId);
      setActionError(null);
      setNotice(null);
      try {
        await deleteExpense(activeUser, groupId, expenseId);
        await refreshGroupData(activeUser, groupId);
        setNotice("Expense deleted.");
      } catch (error: unknown) {
        setActionError(toMessage(error));
      } finally {
        setPendingDeleteId(null);
      }
    },
    [activeUser, groupId, refreshGroupData],
  );

  const groupSelected = activeUser !== null && groupId !== null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">SplitBill</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Split group expenses in THB — every amount is computed in integer satang, never floats.
        </p>
      </header>

      <UserGroupPicker
        userInput={userInput}
        onUserInputChange={setUserInput}
        knownUsers={knownUsers}
        activeUser={activeUser}
        onLoadUser={loadUser}
        userLoading={groupsLoading}
        groups={groups}
        groupsLoading={groupsLoading}
        groupsError={groupsError}
        selectedGroupId={groupId}
        onSelectGroup={selectGroup}
      />

      <div className="mt-4 grid gap-3" aria-live="polite">
        {actionError !== null && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}
        {notice !== null && <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />}
      </div>

      {activeUser === null && (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          Enter a user name and show their groups to begin. Try <code className="font-mono">alice</code>.
        </p>
      )}

      {groupSelected && groupLoading && (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400" role="status">
          Loading group…
        </p>
      )}

      {groupSelected && !groupLoading && groupError !== null && (
        <div className="mt-4">
          <ErrorBanner message={groupError} onDismiss={() => setGroupError(null)} />
        </div>
      )}

      {groupSelected && !groupLoading && groupError === null && (
        <section className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Remounted per user+group so form defaults reset on context change. */}
          <ExpenseForm
            key={`${activeUser}-${groupId}`}
            members={members}
            currentUser={activeUser}
            submitting={submitting}
            onSubmit={handleCreateExpense}
          />
          <div className="grid gap-4">
            <BalancesPanel balances={balances} currentUser={activeUser} />
            <ExpenseList
              expenses={expenses}
              currentUser={activeUser}
              pendingDeleteId={pendingDeleteId}
              onDelete={handleDeleteExpense}
            />
          </div>
        </section>
      )}
    </main>
  );
}
