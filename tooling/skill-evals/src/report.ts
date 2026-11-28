/**
 * The run's report: one markdown section per task with both arms side by side, and the run record
 * the JSON file holds. A cell is a sample only when it finished, or skipped the agent, and nothing
 * set it apart; every ratio and mean counts samples alone, and the other cells are listed.
 */

import type { CellResult } from "./cell.ts";
import type { CheckResult } from "./checks.ts";
import { ARMS } from "./task.ts";
import type { Arm, Task } from "./task.ts";

/** A hash of one input, so two reports can be compared. */
export type InputDigest = { readonly name: string; readonly sha256: string };

/** Where the run's inputs came from. */
export type RunProvenance = {
  readonly model: string;
  /** The checkout's commit at run time. */
  readonly checkoutCommit: string;
  /** Files that differ from that commit in the checkout at run time. */
  readonly uncommitted: readonly string[];
  /** The install command the catalog tells agents to run. */
  readonly installCommand: string | undefined;
  /** What `claude --version` printed. */
  readonly claudeVersion: string;
  /**
   * The pass's snapshot: the server bundle, the catalog, each skill file, the task file and each
   * fixture's frozen lockfile.
   */
  readonly inputs: readonly InputDigest[];
  readonly startedAt: string;
};

/** The whole run, as the JSON file holds it. */
export type RunRecord = RunProvenance & {
  /** Every installed `@elmeragroup/fuse` version, over all cells. */
  readonly fuseVersions: readonly string[];
  /**
   * What the agent runs cost together, in US dollars. A `subtotal` leaves out a run whose cost the
   * CLI never reported, as after a timeout.
   */
  readonly cost: { readonly _tag: "total" | "subtotal"; readonly usd: number };
  /** The checks on each task's untouched fixture, before any agent ran. */
  readonly untouched: Readonly<Record<string, readonly CheckResult[]>>;
  readonly cells: readonly CellResult[];
};

/**
 * Builds the run record from the cells finished so far.
 *
 * @param provenance - Where the inputs came from.
 * @param untouched - The checks on each task's untouched fixture, by task id.
 * @param cells - The finished cells.
 * @returns The record.
 */
export function runRecord(
  provenance: RunProvenance,
  untouched: Readonly<Record<string, readonly CheckResult[]>>,
  cells: readonly CellResult[]
): RunRecord {
  const costs = cells.flatMap((cell) => (cell.agent === undefined ? [] : [cell.agent.cost]));
  return {
    ...provenance,
    fuseVersions: [
      ...new Set(cells.flatMap((cell) => (cell.fuseVersion === undefined ? [] : [cell.fuseVersion]))),
    ].sort(),
    cost: {
      _tag: costs.some((cost) => cost._tag === "unknown") ? "subtotal" : "total",
      usd: costs.reduce((sum, cost) => sum + (cost._tag === "known" ? cost.usd : 0), 0),
    },
    untouched,
    cells,
  };
}

/**
 * Whether a cell counts in its arm's ratios and means: its agent finished, or the run skipped the
 * agent, and nothing set it apart.
 */
function isSample(cell: CellResult): boolean {
  return (
    (cell.status._tag === "finished" || cell.status._tag === "agent-skipped") &&
    cell.sample._tag === "counted"
  );
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

function firstLine(text: string): string {
  const line = text.split("\n").find((item) => item.trim() !== "") ?? "";
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}

/** One task's section. */
function taskSection(
  task: Task,
  cells: readonly CellResult[],
  untouched: readonly CheckResult[] | undefined
): string {
  const taskCells = cells.filter((cell) => cell.task === task.id);
  const arms = ARMS.filter((arm) => taskCells.some((cell) => cell.arm === arm));
  if (arms.length === 0) return "";
  const all = (arm: Arm) => taskCells.filter((cell) => cell.arm === arm);
  const samples = (arm: Arm) => all(arm).filter(isSample);
  const table = (rows: readonly string[]) => [
    `| | ${arms.map((arm) => ARM_HEADINGS[arm]).join(" | ")} |`,
    `|---|${arms.map(() => "---").join("|")}|`,
    ...rows,
  ];
  const row = (label: string, value: (arm: Arm) => string) => `| ${label} | ${arms.map(value).join(" | ")} |`;
  const passedCount = (arm: Arm, name: string) =>
    samples(arm).filter((cell) => cell.checks.some((check) => check.name === name && check.passed)).length;
  const checkRow = (name: string) =>
    row(name, (arm) => `${String(passedCount(arm, name))}/${String(samples(arm).length)}`);

  const checkNames = [...new Set(taskCells.flatMap((cell) => cell.checks.map((check) => check.name)))];
  const guards = checkNames.filter(
    (name) => untouched?.some((check) => check.name === name && check.passed) === true
  );
  const own = checkNames.filter((name) => !guards.includes(name));

  const agents = (arm: Arm) => samples(arm).flatMap((cell) => (cell.agent === undefined ? [] : [cell.agent]));
  const endings = (arm: Arm) =>
    agents(arm).flatMap((agent) => (agent.run.ending._tag === "result" ? [agent.run.ending] : []));
  const toolNames = [
    ...new Set(taskCells.flatMap((cell) => Object.keys(cell.agent?.run.toolCalls ?? {}))),
  ].sort();
  const statusCount = (arm: Arm) => {
    const group = all(arm);
    const count = (tag: CellResult["status"]["_tag"]) =>
      group.filter((cell) => cell.status._tag === tag).length;
    const setApart = group.filter((cell) => !isSample(cell) && cell.sample._tag === "set-apart").length;
    return [
      `${String(samples(arm).length)} of ${String(group.length)} counted`,
      ...(count("unfinished") > 0 ? [`${String(count("unfinished"))} unfinished`] : []),
      ...(count("not-started") > 0 ? [`${String(count("not-started"))} not started`] : []),
      ...(setApart > 0 ? [`${String(setApart)} set apart`] : []),
    ].join(", ");
  };

  const lines = [
    `## ${task.id}`,
    "",
    `Skill \`${task.skill}\`, fixture \`${task.fixture}\`. A check row counts the samples that passed it, and a number is the mean over samples. A sample is a run that finished and that nothing set apart.`,
    "",
    ...table([row("Runs", statusCount)]),
    "",
    "Holds before the agent runs, on the untouched fixture:",
    "",
    ...(guards.length === 0 ? ["None."] : table(guards.map(checkRow))),
    "",
    "The task's own checks:",
    "",
    ...table([
      ...own.map(checkRow),
      row("**Task checks passed**", (arm) => {
        const passed = samples(arm).reduce(
          (sum, cell) =>
            sum +
            own.filter((name) => cell.checks.some((check) => check.name === name && check.passed)).length,
          0
        );
        return `${String(passed)}/${String(samples(arm).length * own.length)}`;
      }),
    ]),
    "",
    ...table([
      row("Turns", (arm) => mean(endings(arm).map((ending) => ending.turns))),
      row("Tool calls", (arm) =>
        mean(
          agents(arm).map((agent) =>
            Object.values(agent.run.toolCalls).reduce((sum, count) => sum + count, 0)
          )
        )
      ),
      ...toolNames.map((tool) =>
        row(`&nbsp;&nbsp;${tool.replace(/^mcp__fuse__/u, "fuse ")}`, (arm) =>
          mean(agents(arm).map((agent) => agent.run.toolCalls[tool] ?? 0))
        )
      ),
      row("Duration (s)", (arm) => mean(endings(arm).map((ending) => Math.round(ending.durationMs / 1000)))),
      row("Cost (USD)", (arm) => {
        const costs = endings(arm).map((ending) => ending.costUsd);
        return costs.length === 0
          ? "–"
          : `$${(costs.reduce((sum, cost) => sum + cost, 0) / costs.length).toFixed(2)}`;
      }),
      row("Skill reads received", (arm) =>
        mean(agents(arm).map((agent) => agent.run.skillReads.filter((read) => read.received).length))
      ),
      row("Server's skills", (arm) =>
        [
          ...new Set(
            all(arm).map((cell) => {
              if (cell.server === undefined) return "–";
              return cell.server.skills._tag === "listed"
                ? `${String(cell.server.skills.uris.length)} listed`
                : "no Skills extension";
            })
          ),
        ].join(", ")
      ),
      row("`@elmeragroup/fuse`", (arm) =>
        [...new Set(all(arm).map((cell) => cell.fuseVersion ?? "none"))].join(", ")
      ),
    ]),
  ];

  const notes = arms.flatMap((arm) =>
    all(arm).flatMap((cell) => {
      const label = `${arm} #${String(cell.repeat)}`;
      const status =
        cell.status._tag === "not-started"
          ? [`- ${label} did not start: ${firstLine(cell.status.message)}`]
          : cell.status._tag === "unfinished"
            ? [`- ${label} did not finish: ${cell.status.reason}`]
            : [];
      const apart =
        cell.sample._tag === "set-apart"
          ? [`- ${label} is set apart: ${cell.sample.reasons.join("; ")}`]
          : [];
      const failed = isSample(cell)
        ? cell.checks
            .filter((check) => !check.passed)
            .map((check) => `- ${label}, ${check.name}: ${firstLine(check.detail)}`)
        : [];
      return [...status, ...apart, ...failed];
    })
  );
  if (notes.length > 0) lines.push("", "Cells outside the counts, and failed checks:", "", ...notes);
  return lines.join("\n");
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
    `- Model: \`${record.model}\`, \`claude\` ${record.claudeVersion}`,
    `- \`@elmeragroup/fuse\` installed: ${record.fuseVersions.map((version) => `\`${version}\``).join(", ") || "none"}`,
    `- The checkout's commit at run time: \`${record.checkoutCommit}\`${record.uncommitted.length === 0 ? "" : `, with uncommitted changes to ${record.uncommitted.map((file) => `\`${file}\``).join(", ")}`}`,
    `- Install command in the catalog: ${record.installCommand === undefined ? "not found" : `\`${record.installCommand}\``}`,
    `- Started ${record.startedAt}. Agent cost${record.cost._tag === "subtotal" ? ", a subtotal without the runs whose cost is unknown" : ""}: $${record.cost.usd.toFixed(2)}`,
    "",
    "<details><summary>Inputs, by SHA-256</summary>",
    "",
    "| Input | SHA-256 |",
    "|---|---|",
    ...record.inputs.map((input) => `| \`${input.name}\` | \`${input.sha256.slice(0, 16)}\` |`),
    "",
    "</details>",
    "",
    ...tasks
      .map((task) => taskSection(task, record.cells, record.untouched[task.id]))
      .filter((section) => section !== "")
      .flatMap((section) => [section, ""]),
  ].join("\n");
}
