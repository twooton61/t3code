import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { environmentRpcKey } from "@t3tools/client-runtime/state/runtime";
import {
  EnvironmentId,
  ProjectId,
  ThreadId,
  type ReviewDiffPreviewResult,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  resolveDiffPanelWorkspace,
  selectDiffPanelThread,
  selectDiffPreviewForWorkspace,
} from "./diffPanelWorkspace";

const ENVIRONMENT_ID = EnvironmentId.make("environment-1");
const FIRST_THREAD_ID = ThreadId.make("thread-1");
const IMPORTED_THREAD_ID = ThreadId.make("thread-imported");
const FIRST_PROJECT_ID = ProjectId.make("project-1");
const IMPORTED_PROJECT_ID = ProjectId.make("project-imported");
const FIRST_WORKTREE = "/repos/t3code/worktrees/background-opacity";
const IMPORTED_WORKTREE =
  "/home/terry/.herdr/worktrees/miami-astro-website/qr-202609141734-subnav-audit";

function thread(
  id: ThreadId,
  projectId: ProjectId,
  worktreePath: string | null,
): EnvironmentThreadShell {
  return {
    id,
    projectId,
    worktreePath,
    environmentId: ENVIRONMENT_ID,
  } as EnvironmentThreadShell;
}

function project(id: ProjectId, workspaceRoot: string): EnvironmentProject {
  return {
    id,
    workspaceRoot,
    environmentId: ENVIRONMENT_ID,
  } as EnvironmentProject;
}

function route(threadId: ThreadId): ScopedThreadRef {
  return { environmentId: ENVIRONMENT_ID, threadId };
}

function preview(cwd: string, diff: string): ReviewDiffPreviewResult {
  return {
    cwd,
    generatedAt: DateTime.makeUnsafe("2026-09-18T12:00:00.000Z"),
    sources: [
      {
        id: "working-tree",
        kind: "working-tree",
        title: "Working tree",
        baseRef: null,
        headRef: "main",
        diff,
        diffHash: `${cwd}:hash`,
        truncated: false,
      },
      {
        id: "branch-range",
        kind: "branch-range",
        title: "Branch changes",
        baseRef: "main",
        headRef: "feature",
        diff,
        diffHash: `${cwd}:branch-hash`,
        truncated: false,
      },
    ],
  };
}

describe("Diff panel workspace identity", () => {
  it("clears a previous repository preview while an imported worktree preview is pending", () => {
    const firstWorkspace = resolveDiffPanelWorkspace(
      route(FIRST_THREAD_ID),
      thread(FIRST_THREAD_ID, FIRST_PROJECT_ID, FIRST_WORKTREE),
      project(FIRST_PROJECT_ID, "/repos/t3code"),
    );
    const importedWorkspace = resolveDiffPanelWorkspace(
      route(IMPORTED_THREAD_ID),
      thread(IMPORTED_THREAD_ID, IMPORTED_PROJECT_ID, null),
      project(IMPORTED_PROJECT_ID, IMPORTED_WORKTREE),
    );
    const firstPreview = preview(FIRST_WORKTREE, "diff --git a/themePalette.ts b/themePalette.ts");

    expect(firstWorkspace?.cwd).toBe(FIRST_WORKTREE);
    expect(importedWorkspace?.cwd).toBe(IMPORTED_WORKTREE);
    expect(importedWorkspace?.threadId).toBe(IMPORTED_THREAD_ID);
    expect(
      environmentRpcKey({
        environmentId: firstWorkspace!.environmentId,
        input: { cwd: firstWorkspace!.cwd },
      }),
    ).not.toBe(
      environmentRpcKey({
        environmentId: importedWorkspace!.environmentId,
        input: { cwd: importedWorkspace!.cwd },
      }),
    );
    expect(selectDiffPreviewForWorkspace(importedWorkspace, firstPreview)).toBeNull();

    const importedPreview = preview(
      IMPORTED_WORKTREE,
      "diff --git a/src/components/Subnav.astro b/src/components/Subnav.astro",
    );
    expect(selectDiffPreviewForWorkspace(importedWorkspace, importedPreview)).toBe(importedPreview);
    expect(importedPreview.sources.map((source) => source.kind)).toEqual([
      "working-tree",
      "branch-range",
    ]);
  });

  it("does not resolve workspace data from a thread or project left over from another route", () => {
    expect(
      selectDiffPanelThread(
        route(IMPORTED_THREAD_ID),
        thread(FIRST_THREAD_ID, FIRST_PROJECT_ID, FIRST_WORKTREE),
      ),
    ).toBeNull();

    expect(
      resolveDiffPanelWorkspace(
        route(IMPORTED_THREAD_ID),
        thread(FIRST_THREAD_ID, FIRST_PROJECT_ID, FIRST_WORKTREE),
        project(FIRST_PROJECT_ID, "/repos/t3code"),
      ),
    ).toBeNull();

    expect(
      resolveDiffPanelWorkspace(
        route(IMPORTED_THREAD_ID),
        thread(IMPORTED_THREAD_ID, IMPORTED_PROJECT_ID, null),
        project(FIRST_PROJECT_ID, "/repos/t3code"),
      ),
    ).toBeNull();
  });
});
