import type { Group } from "@/lib/api";

interface UserGroupPickerProps {
  userInput: string;
  onUserInputChange: (value: string) => void;
  knownUsers: string[];
  activeUser: string | null;
  onLoadUser: () => void;
  userLoading: boolean;
  groups: Group[] | null;
  groupsLoading: boolean;
  groupsError: string | null;
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number) => void;
}

/**
 * Requirement 1: user and group selection. Groups are fetched for the entered
 * user only (the API filters by the `X-User` header), so only that user's
 * groups are ever listed.
 */
export function UserGroupPicker(props: UserGroupPickerProps) {
  const {
    userInput,
    onUserInputChange,
    knownUsers,
    activeUser,
    onLoadUser,
    userLoading,
    groups,
    groupsLoading,
    groupsError,
    selectedGroupId,
    onSelectGroup,
  } = props;

  return (
    <section aria-labelledby="who-heading" className="rounded-xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
      <h2 id="who-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        1 · Choose a user
      </h2>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onLoadUser();
        }}
      >
        <div className="flex-1">
          <label htmlFor="user-input" className="sr-only">
            User name
          </label>
          <input
            id="user-input"
            type="text"
            autoComplete="off"
            list="known-users"
            placeholder="e.g. alice"
            value={userInput}
            onChange={(event) => onUserInputChange(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-400 dark:focus:ring-neutral-700"
          />
          <datalist id="known-users">
            {knownUsers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <button
          type="submit"
          disabled={userLoading}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {userLoading ? "Loading…" : "Show groups"}
        </button>
      </form>

      {groupsError !== null && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{groupsError}</p>}

      {activeUser !== null && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">
            2 · Pick a group{" "}
            <span className="font-normal text-neutral-500 dark:text-neutral-400">— groups of “{activeUser}”</span>
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {groupsLoading && <li className="text-sm text-neutral-500 dark:text-neutral-400">Loading groups…</li>}
            {!groupsLoading && groupsError === null && groups !== null && groups.length === 0 && (
              <li className="text-sm text-neutral-500 dark:text-neutral-400">No groups for this user yet.</li>
            )}
            {!groupsLoading &&
              groups?.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => onSelectGroup(group.id)}
                    aria-pressed={selectedGroupId === group.id}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedGroupId === group.id
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-300 bg-white hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-400"
                    }`}
                  >
                    <span className="block font-medium">{group.name}</span>
                    <span className="block text-xs opacity-70">
                      {Array.isArray(group.members) ? `${group.members.length} members` : `Group #${group.id}`}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
