import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { ReviewDiffPreviewResult, ScopedThreadRef } from "@t3tools/contracts";

export interface DiffPanelWorkspace {
  readonly environmentId: EnvironmentThreadShell["environmentId"];
  readonly threadId: EnvironmentThreadShell["id"];
  readonly cwd: string;
  readonly repositoryRoot: string | undefined;
}

export function selectDiffPanelThread(
  routeThreadRef: ScopedThreadRef | null,
  thread: EnvironmentThreadShell | null,
): EnvironmentThreadShell | null {
  return routeThreadRef !== null &&
    thread !== null &&
    thread.environmentId === routeThreadRef.environmentId &&
    thread.id === routeThreadRef.threadId
    ? thread
    : null;
}

export function resolveDiffPanelWorkspace(
  routeThreadRef: ScopedThreadRef | null,
  thread: EnvironmentThreadShell | null,
  project: EnvironmentProject | null,
): DiffPanelWorkspace | null {
  const activeThread = selectDiffPanelThread(routeThreadRef, thread);
  if (
    activeThread === null ||
    project === null ||
    project.environmentId !== activeThread.environmentId ||
    project.id !== activeThread.projectId
  ) {
    return null;
  }

  return {
    environmentId: activeThread.environmentId,
    threadId: activeThread.id,
    cwd: activeThread.worktreePath ?? project.workspaceRoot,
    repositoryRoot: activeThread.worktreePath ? undefined : project.repositoryIdentity?.rootPath,
  };
}

export function selectDiffPreviewForWorkspace(
  workspace: DiffPanelWorkspace | null,
  preview: ReviewDiffPreviewResult | null,
): ReviewDiffPreviewResult | null {
  return workspace !== null && preview?.cwd === workspace.cwd ? preview : null;
}
