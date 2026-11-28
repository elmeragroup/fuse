import { describe, expect, it } from "vitest";

import type { CellKey, CellResult } from "../src/cell.ts";
import { renderReport, runRecord } from "../src/report.ts";
import type { RunProvenance } from "../src/report.ts";
import type { Arm, Task } from "../src/task.ts";

// Unit under test: how the record and the report count a pass's cells. Oracle: the plan the test
// writes, one task with two arms and two repeats, so four cells, against the cells recorded so far.

const TASK: Task = {
  id: "build-ui-toggle-group",
  skill: "fuse-build-ui",
  handsOverTo: [],
  fixture: "vite-tailwind-fuse",
  prompt: "Add a toggle group.",
  document: { identity: "branded", brand: "fkas", segment: "private", density: "comfortable" },
  stylesheet: "tailwind",
  sourceChecks: [],
  expectations: [],
};

const PLAN: readonly CellKey[] = (["with-skill", "baseline"] as const).flatMap((arm) =>
  [1, 2].map((repeat) => ({ task: TASK, arm, repeat }))
);

const PROVENANCE: RunProvenance = {
  model: "sonnet",
  checkoutCommit: "0ff3ce522",
  uncommitted: [],
  installCommand: undefined,
  claudeVersion: "(not run)",
  inputs: [],
  startedAt: "2026-11-28T10:00:00.000Z",
};

function cell(arm: Arm, repeat: number): CellResult {
  return {
    task: TASK.id,
    arm,
    repeat,
    outcome: { _tag: "counted" },
    setApartReasons: [],
    appDirectory: `/runs/${arm}-${String(repeat)}`,
    prompt: TASK.prompt,
    server: undefined,
    fuseVersion: undefined,
    agent: undefined,
    checks: [],
  };
}

function report(cells: readonly CellResult[]) {
  const record = runRecord(PROVENANCE, {}, cells, 0, PLAN.length);
  const lines = renderReport(record, PLAN).split("\n");
  return {
    counts: { planned: record.plannedCells, recorded: record.recordedCells },
    progress: lines.filter((line) => line.includes("cells recorded")),
    runs: lines.filter((line) => line.startsWith("| Runs ")),
  };
}

describe("the pass's progress", () => {
  it("says a stopped pass is not finished and counts each arm against its plan", () => {
    expect(report([cell("baseline", 1)])).toEqual({
      counts: { planned: 4, recorded: 1 },
      progress: ["- 1 of 4 cells recorded. The pass is not finished."],
      runs: ["| Runs | 0 counted (of 2) | 1 counted (of 2) |"],
    });
  });

  it("says the pass is complete once every planned cell has a record", () => {
    expect(report(PLAN.map((key) => cell(key.arm, key.repeat)))).toEqual({
      counts: { planned: 4, recorded: 4 },
      progress: ["- 4 of 4 cells recorded. The pass is complete."],
      runs: ["| Runs | 2 counted (of 2) | 2 counted (of 2) |"],
    });
  });
});
