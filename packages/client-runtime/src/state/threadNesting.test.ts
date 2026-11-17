import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  collapseNestedGroups,
  groupNestedThreads,
  nestedRowKey,
  nestedRowKeys,
} from "./threadNesting.ts";

const local = EnvironmentId.make("local");
const remote = EnvironmentId.make("remote");

const thread = (id: string, parent: string | null = null, environmentId = local) => ({
  id: ThreadId.make(id),
  environmentId,
  nestedUnderThreadId: parent === null ? null : ThreadId.make(parent),
});

const ids = (threads: ReadonlyArray<{ readonly id: string }>) => threads.map((t) => t.id);

describe("groupNestedThreads", () => {
  it.each([
    {
      name: "moves children below their parent in list order",
      threads: [thread("a"), thread("w2", "c"), thread("c"), thread("b"), thread("w1", "c")],
      expected: ["a", "c", "w2", "w1", "b"],
    },
    {
      name: "flattens grandchildren under the top-level thread",
      threads: [thread("gc", "child"), thread("root"), thread("child", "root")],
      expected: ["root", "gc", "child"],
    },
    {
      name: "keeps a thread in place when its parent is not listed",
      threads: [thread("a"), thread("orphan", "gone"), thread("b")],
      expected: ["a", "orphan", "b"],
    },
    {
      name: "keeps cycles in place",
      threads: [thread("x", "y"), thread("a"), thread("y", "x")],
      expected: ["x", "a", "y"],
    },
    {
      name: "does not nest under a same-id thread from another environment",
      threads: [thread("p", null, remote), thread("a"), thread("w", "p")],
      expected: ["p", "a", "w"],
    },
  ])("$name", ({ threads, expected }) => {
    expect(ids(groupNestedThreads(threads))).toEqual(expected);
  });
});

describe("nestedRowKeys", () => {
  it("indents only rows that sit under their group, and resets at boundaries", () => {
    const rows = [
      thread("c"),
      thread("w1", "c"),
      thread("gc", "w1"),
      thread("b"),
      thread("w2", "c"),
      null,
      thread("c2"),
      null,
      thread("w3", "c2"),
    ];
    const nested = nestedRowKeys(rows);
    expect(
      rows.flatMap((row) => (row !== null && nested.has(nestedRowKey(row)) ? [row.id] : [])),
    ).toEqual(["w1", "gc"]);
  });
});

describe("collapseNestedGroups", () => {
  const rows = [thread("c"), thread("w1", "c"), thread("gc", "w1"), thread("b"), thread("w2", "b")];

  it("counts each group's nested rows and hides only collapsed groups", () => {
    const result = collapseNestedGroups(rows, new Set([nestedRowKey(thread("c"))]), () => false);
    expect(ids(result.rows)).toEqual(["c", "b", "w2"]);
    expect(
      [...result.groups].map(([key, group]) => [key, group.childCount, ids(group.hidden)]),
    ).toEqual([
      [nestedRowKey(thread("c")), 2, ["w1", "gc"]],
      [nestedRowKey(thread("b")), 1, []],
    ]);
  });

  it("keeps a hidden row the caller asks for", () => {
    const result = collapseNestedGroups(
      rows,
      new Set([nestedRowKey(thread("c"))]),
      (row) => row.id === "gc",
    );
    expect(ids(result.rows)).toEqual(["c", "gc", "b", "w2"]);
  });
});
