import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { nestedRowKey } from "@t3tools/client-runtime/state/thread-nesting";
import { AsyncResult } from "effect/reactivity";
import { useMemo } from "react";

import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";

const COLLAPSED_NEST_PARENTS_LIMIT = 200;
const NO_COLLAPSED_NEST_PARENTS: readonly string[] = [];

export function useThreadListV2ShelfPreferences() {
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const loaded = AsyncResult.isSuccess(preferencesResult);
  const snoozedShelfExpanded =
    loaded && preferencesResult.value.threadListSnoozedShelfExpanded === true;
  const settledShelfExpanded =
    loaded && preferencesResult.value.threadListSettledShelfExpanded === true;
  const workingShelfEnabled = loaded && preferencesResult.value.workingShelfEnabled !== false;
  const workingShelfExpanded =
    loaded && preferencesResult.value.threadListWorkingShelfExpanded === true;
  const collapsedNestParents =
    (loaded ? preferencesResult.value.threadListCollapsedNestParents : undefined) ??
    NO_COLLAPSED_NEST_PARENTS;
  const collapsedNestKeys = useMemo(() => new Set(collapsedNestParents), [collapsedNestParents]);

  // Transforms read optimistic state so same-frame presses toggle twice.
  const toggleSnoozedShelf = () => {
    if (!loaded) return;
    savePreferences({
      transform: (current) => ({
        threadListSnoozedShelfExpanded: current.threadListSnoozedShelfExpanded !== true,
      }),
    });
  };
  const toggleSettledShelf = () => {
    if (!loaded) return;
    savePreferences({
      transform: (current) => ({
        threadListSettledShelfExpanded: current.threadListSettledShelfExpanded !== true,
      }),
    });
  };
  const toggleWorkingShelf = () => {
    if (!loaded) return;
    savePreferences({
      transform: (current) => ({
        threadListWorkingShelfExpanded: current.threadListWorkingShelfExpanded !== true,
      }),
    });
  };

  const toggleNestGroup = (thread: Parameters<typeof nestedRowKey>[0]) => {
    if (!loaded) return;
    const key = nestedRowKey(thread);
    savePreferences({
      transform: (current) => {
        const keys = current.threadListCollapsedNestParents ?? NO_COLLAPSED_NEST_PARENTS;
        return {
          threadListCollapsedNestParents: keys.includes(key)
            ? keys.filter((existing) => existing !== key)
            : [...keys, key].slice(-COLLAPSED_NEST_PARENTS_LIMIT),
        };
      },
    });
  };

  return {
    loaded,
    collapsedNestKeys,
    toggleNestGroup,
    settledShelfExpanded,
    snoozedShelfExpanded,
    workingShelfEnabled,
    workingShelfExpanded,
    toggleSettledShelf,
    toggleSnoozedShelf,
    toggleWorkingShelf,
  } as const;
}
