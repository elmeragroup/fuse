/**
 * The run's report: one markdown table per task with both arms side by side, and the run record
 * the JSON file holds.
 */

import type { CellResult } from "./cell.ts";
import { ARMS } from "./task.ts";
import type { Arm, Task } from "./task.ts";

/** Where the run's inputs came from. */
export type RunProvenance = {
  readonly model: string;
  /** The commit the catalog was generated from. */
  readonly commit: string;
  /** Files that differ from that commit in the checkout the catalog was generated in. */
  readonly uncommitted: readonly string[];
  /** The install command the catalog tells agents to run. */
  readonly installCommand: string | undefined;
  readonly startedAt: string;
};

/** The whole run, as the JSON file holds it. */
export type RunRecord = RunProvenance & {
  /** Every installed `@elmeragroup/fuse` version, over all cells. */
  readonly fuseVersions: readonly string[];
  /** What every agent run cost together, in US dollars. */
  readonly totalCostUsd: number;
  readonly cells: readonly CellResult[];
};

/**
 * Builds the run record from the cells finished so far.
 *
 * @param provenance - Where the inputs came from.
 * @param cells - The finished cells.
 * @returns The record.
 */
export function runRecord(provenance: RunProvenance, cells: readonly CellResult[]): RunRecord {
  return {
    ...provenance,
    fuseVersions: [
      ...new Set(cells.flatMap((cell) => (cell.fuseVersion === undefined ? [] : [cell.fuseVersion]))),
    ].sort(),
    totalCostUsd: cells.reduce((sum, cell) => sum + costOf(cell), 0),
    cells,
  };
}

function costOf(cell: CellResult): number {
  return cell.agent?.ending._tag === "finished" ? cell.agent.ending.costUsd : 0;
}

const ARM_HEADINGS = {
  "with-skill": "With the skill",
  baseline: "Without (baseline)",
} as const satisfies Record<Arm, string>;

/** A mean, with one decimal when it is not whole. */
function mean(values: readonly number[]): string {
  if (values.length === 0) return "–";
  const value = values.reduce((sum, item) => sum + item, 0) / values.length;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** One task's table. */
function taskSection(task: Task, cells: readonly CellResult[]): string {
  const byArm = new Map(
    ARMS.map((arm) => [arm, cells.filter((cell) => cell.task === task.id && cell.arm === arm)])
  );
  const arms = ARMS.filter((arm) => (byArm.get(arm) ?? []).length > 0);
  if (arms.length === 0) return "";
  const column = (arm: Arm) => byArm.get(arm) ?? [];
  const row = (label: string, value: (cells: readonly CellResult[]) => string) =>
    `| ${label} | ${arms.map((arm) => value(column(arm))).join(" | ")} |`;

  const checkNames = [
    ...new Set(
      cells.filter((cell) => cell.task === task.id).flatMap((cell) => cell.checks.map((c) => c.name))
    ),
  ];
  const agents = (group: readonly CellResult[]) =>
    group.flatMap((cell) => (cell.agent === undefined ? [] : [cell.agent]));
  const finished = (group: readonly CellResult[]) =>
    agents(group).flatMap((agent) => (agent.ending._tag === "finished" ? [agent.ending] : []));
  const toolNames = [
    ...new Set(
      cells
        .filter((cell) => cell.task === task.id)
        .flatMap((cell) => Object.keys(cell.agent?.toolCalls ?? {}))
    ),
  ].sort();

  const lines = [
    `## ${task.id}`,
    "",
    `Skill \`${task.skill}\`, fixture \`${task.fixture}\`. ${String(Math.max(...arms.map((arm) => column(arm).length)))} run(s) per arm; a check row counts the runs that passed it, and a number is the mean.`,
    "",
    `| | ${arms.map((arm) => ARM_HEADINGS[arm]).join(" | ")} |`,
    `|---|${arms.map(() => "---").join("|")}|`,
    row(
      "Setup",
      (group) =>
        `${String(group.filter((cell) => cell.status._tag === "checked").length)}/${String(group.length)} ran`
    ),
    ...checkNames.map((name) =>
      row(name, (group) => {
        const ran = group.filter((cell) => cell.status._tag === "checked");
        const passed = ran.filter((cell) => cell.checks.some((check) => check.name === name && check.passed));
        return `${String(passed.length)}/${String(ran.length)}`;
      })
    ),
    row("Turns", (group) => mean(finished(group).map((ending) => ending.turns))),
    row("Tool calls", (group) =>
      mean(
        agents(group).map((agent) => Object.values(agent.toolCalls).reduce((sum, count) => sum + count, 0))
      )
    ),
    ...toolNames.map((tool) =>
      row(`&nbsp;&nbsp;${tool.replace(/^mcp__fuse__/u, "fuse ")}`, (group) =>
        mean(agents(group).map((agent) => agent.toolCalls[tool] ?? 0))
      )
    ),
    row("Duration (s)", (group) =>
      mean(finished(group).map((ending) => Math.round(ending.durationMs / 1000)))
    ),
    row("Cost (USD)", (group) => {
      const costs = finished(group).map((ending) => ending.costUsd);
      return costs.length === 0
        ? "–"
        : `$${(costs.reduce((sum, cost) => sum + cost, 0) / costs.length).toFixed(2)}`;
    }),
    row(
      "Ended",
      (group) =>
        agents(group)
          .map((agent) => (agent.ending._tag === "finished" ? agent.ending.subtype : "cut off"))
          .join(", ") || "–"
    ),
    row("Server's `skills/list`", (group) =>
      [
        ...new Set(
          group.map((cell) => {
            if (cell.server === undefined) return "–";
            return cell.server.skills._tag === "listed"
              ? `${String(cell.server.skills.uris.length)} skills`
              : "method not found";
          })
        ),
      ].join(", ")
    ),
    row("Skill reads", (group) => mean(agents(group).map((agent) => agent.skillReads.length))),
    row("`@elmeragroup/fuse`", (group) =>
      [...new Set(group.map((cell) => cell.fuseVersion ?? "none"))].join(", ")
    ),
  ];

  const failures = arms.flatMap((arm) =>
    column(arm).flatMap((cell) => [
      ...(cell.status._tag === "setup-failed"
        ? [`- ${arm} #${String(cell.repeat)}: setup failed. ${firstLine(cell.status.message)}`]
        : []),
      ...cell.checks
        .filter((check) => !check.passed)
        .map((check) => `- ${arm} #${String(cell.repeat)}, ${check.name}: ${firstLine(check.detail)}`),
    ])
  );
  if (failures.length > 0) lines.push("", "Failed checks:", "", ...failures);
  return lines.join("\n");
}

function firstLine(text: string): string {
  const line = text.split("\n").find((item) => item.trim() !== "") ?? "";
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}

/**
 * The markdown report.
 *
 * @param record - The run.
 * @param tasks - The tasks the run covered, in report order.
 * @returns The report text.
 */
export function renderReport(record: RunRecord, tasks: readonly Task[]): string {
  return [
    "# Fuse skill evals",
    "",
    `- Model: \`${record.model}\``,
    `- \`@elmeragroup/fuse\` installed: ${record.fuseVersions.map((version) => `\`${version}\``).join(", ") || "none"}`,
    `- Catalog generated from \`${record.commit}\`${record.uncommitted.length === 0 ? "" : `, with uncommitted changes to ${record.uncommitted.map((file) => `\`${file}\``).join(", ")}`}`,
    `- Install command in the catalog: ${record.installCommand === undefined ? "not found" : `\`${record.installCommand}\``}`,
    `- Started ${record.startedAt}. Agent cost: $${record.totalCostUsd.toFixed(2)}`,
    "",
    ...tasks
      .map((task) => taskSection(task, record.cells))
      .filter((section) => section !== "")
      .flatMap((section) => [section, ""]),
  ].join("\n");
}
