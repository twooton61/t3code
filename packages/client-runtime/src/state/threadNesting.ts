import {
  type EnvironmentId,
  isListedThreadLineage,
  type OrchestrationV2AppThreadLineage,
  type ThreadId,
} from "@t3tools/contracts";

export interface NestableThread {
  readonly id: ThreadId;
  readonly environmentId: EnvironmentId;
  readonly nestedUnderThreadId?: ThreadId | null;
}

const keyOf = (environmentId: EnvironmentId, threadId: ThreadId) =>
  `${environmentId}\u0000${threadId}`;

/**
 * Moves each nested thread directly below the top-level thread it belongs to,
 * one level deep. A group takes the place of its first member, so a busy child
 * lifts its parent. Threads whose parent is not in `threads`, and cycles, stay
 * where they are.
 */
export function groupNestedThreads<T extends NestableThread>(threads: readonly T[]): readonly T[] {
  if (!threads.some((thread) => thread.nestedUnderThreadId != null)) return threads;
  const byKey = new Map(threads.map((thread) => [keyOf(thread.environmentId, thread.id), thread]));
  const rootKeyOf = (thread: T): string => {
    const ownKey = keyOf(thread.environmentId, thread.id);
    const seen = new Set([ownKey]);
    let current = thread;
    let currentKey = ownKey;
    while (current.nestedUnderThreadId != null) {
      const parentKey = keyOf(current.environmentId, current.nestedUnderThreadId);
      const parent = byKey.get(parentKey);
      if (parent === undefined) return currentKey;
      if (seen.has(parentKey)) return ownKey;
      seen.add(parentKey);
      current = parent;
      currentKey = parentKey;
    }
    return currentKey;
  };
  const groups = new Map<string, T[]>();
  for (const thread of threads) {
    const rootKey = rootKeyOf(thread);
    const group = groups.get(rootKey) ?? [];
    groups.set(rootKey, group);
    const isRoot = keyOf(thread.environmentId, thread.id) === rootKey;
    if (isRoot) group.unshift(thread);
    else group.push(thread);
  }
  return [...groups.values()].flat();
}

/**
 * Rows to indent in a rendered sequence: a row whose parent is an earlier row of
 * the current group. `null` marks a section boundary, which ends a group.
 */
export function nestedRowKeys<T extends NestableThread>(
  rows: Iterable<T | null>,
): ReadonlySet<string> {
  const nested = new Set<string>();
  let group = new Set<string>();
  for (const row of rows) {
    if (row === null) {
      group = new Set();
      continue;
    }
    const key = keyOf(row.environmentId, row.id);
    if (
      row.nestedUnderThreadId != null &&
      group.has(keyOf(row.environmentId, row.nestedUnderThreadId))
    ) {
      nested.add(key);
      group.add(key);
    } else {
      group = new Set([key]);
    }
  }
  return nested;
}

export const nestedRowKey = (thread: Pick<NestableThread, "environmentId" | "id">) =>
  keyOf(thread.environmentId, thread.id);

export interface NestedGroup<T> {
  readonly childCount: number;
  readonly hidden: readonly T[];
}

/**
 * Hides the nested rows of each collapsed group in one grouped section, keyed by the group's top
 * row. Rows `keep` accepts stay, so the open thread never vanishes. Each group counts its nested
 * rows before hiding.
 */
export function collapseNestedGroups<T extends NestableThread>(
  rows: readonly T[],
  collapsedKeys: ReadonlySet<string>,
  keep: (row: T) => boolean,
): { readonly rows: readonly T[]; readonly groups: ReadonlyMap<string, NestedGroup<T>> } {
  const groups = new Map<string, { childCount: number; hidden: T[] }>();
  const visible: T[] = [];
  let members = new Set<string>();
  let topKey = "";
  for (const row of rows) {
    const key = keyOf(row.environmentId, row.id);
    if (
      row.nestedUnderThreadId == null ||
      !members.has(keyOf(row.environmentId, row.nestedUnderThreadId))
    ) {
      members = new Set([key]);
      topKey = key;
      visible.push(row);
      continue;
    }
    members.add(key);
    const group = groups.get(topKey) ?? { childCount: 0, hidden: [] };
    groups.set(topKey, group);
    group.childCount += 1;
    if (collapsedKeys.has(topKey) && !keep(row)) group.hidden.push(row);
    else visible.push(row);
  }
  return { rows: visible.length === rows.length ? rows : visible, groups };
}

const NESTING_PARENT_CANDIDATE_LIMIT = 12;

/** Top-level threads of the same project that `thread` can nest under, most recent first. */
export function nestingParentCandidates<
  T extends NestableThread & {
    readonly projectId: string;
    readonly archivedAt: string | null;
    readonly updatedAt: string;
    readonly lineage: OrchestrationV2AppThreadLineage;
  },
>(thread: T, threads: readonly T[]): T[] {
  return threads
    .filter(
      (candidate) =>
        candidate.environmentId === thread.environmentId &&
        candidate.projectId === thread.projectId &&
        candidate.id !== thread.id &&
        candidate.id !== thread.nestedUnderThreadId &&
        candidate.archivedAt === null &&
        candidate.nestedUnderThreadId == null &&
        isListedThreadLineage(candidate.lineage),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, NESTING_PARENT_CANDIDATE_LIMIT);
}
