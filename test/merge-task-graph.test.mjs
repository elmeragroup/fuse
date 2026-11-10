import { expect, it } from "vitest";

import { PUBLISH_GATES } from "../packages/fuse/scripts/release-pack.ts";
import { asRecord, asString } from "./json-object.mjs";
import { readWorkflow, requiredJobSteps, requiredRunStep, turboTasks } from "./workflow.mjs";

/** Gates that run only in the merge workflow's browser job. */
const BROWSER_JOB_GATE = /#test:(browser|e2e|packed-consumer)$/;

/** @param {string} job */
function turboRunStep(job) {
  const step = requiredRunStep(requiredJobSteps(readWorkflow("merge"), job), "pnpm exec turbo run ");
  expect(step.if, `${job} gate must not be conditional`).toBeUndefined();
  return step;
}

/**
 * The arguments a job's turbo command requests, before Turbo resolves them.
 * @param {string} job
 */
function requestedArgs(job) {
  const command = asString(turboRunStep(job).run, `${job} command`);
  expect(command, `${job} gate must be one literal command`).not.toMatch(/\$\{\{|[\r\n]/);
  const tokens = (command.match(/(?:'[^']*'|"[^"]*"|[^\s'"]+)+/g) ?? []).map((token) =>
    token.replace(/['"]/g, "")
  );
  return tokens.slice(4);
}

/** @param {string} job */
function scheduledTasks(job) {
  return resolvedTasks(["run", ...requestedArgs(job)]);
}

/**
 * Turbo also reports placeholders for tasks whose package defines no script; they run no gate.
 * @param {Record<string, unknown>[]} tasks
 */
function executableTaskIds(tasks) {
  return tasks
    .filter((task) => asString(task.command, "task command") !== "<NONEXISTENT>")
    .map((task) => asString(task.taskId, "task id"));
}

/** @type {Map<string, Record<string, unknown>[]>} */
const resolvedGraphs = new Map();

/**
 * Turbo's resolved tasks for an argument list, resolved once per distinct list per file.
 * @param {string[]} args
 */
function resolvedTasks(args) {
  const key = JSON.stringify(args);
  let tasks = resolvedGraphs.get(key);
  if (tasks === undefined) {
    tasks = turboTasks(args);
    resolvedGraphs.set(key, tasks);
  }
  return tasks;
}

/** Fuse's no-op `ci:checks` and `check` scripts, which only anchor each aggregate's fan-out. */
const AGGREGATE_ANCHORS = new Set(["@elmeragroup/fuse#ci:checks", "@elmeragroup/fuse#check"]);

it("the merge checks schedule all required gates without browser work", () => {
  const ids = scheduledTasks("checks").map((task) => asString(task.taskId, "task id"));
  for (const required of [
    "//#lint",
    "//#test:repo-policy",
    "//#type-check:scripts",
    "@elmeragroup/fuse#build",
    "@elmeragroup/fuse#type-check",
    "@elmeragroup/fuse#test",
    "@elmeragroup/fuse#test:types",
    "@elmeragroup/fuse#package:check",
    "@elmeragroup/fuse#api:report",
    "@elmeragroup/color#test",
    "@elmeragroup/color#type-check",
    "docs#build",
    "docs#type-check",
    "docs#test",
    "static-theme#build",
    "static-theme#type-check",
    "static-theme#test",
    "@elmeragroup/oxlint-plugin-fuse#test",
    "@elmeragroup/oxlint-plugin-fuse#type-check",
  ]) {
    expect(ids).toContain(required);
  }
  expect(ids.filter((id) => BROWSER_JOB_GATE.test(id))).toEqual([]);
}, 30_000);

it("splits the ci:checks aggregate exactly between the checks and browser jobs", () => {
  // Unit under test: merge's resolved job graphs. Oracle: turbo.json's ci:checks aggregate.
  // Shared builds count once; Fuse's no-op `ci:checks` and `check` anchors are not gates.
  const aggregate = executableTaskIds(resolvedTasks(["run", "ci:checks"])).filter(
    (id) => !AGGREGATE_ANCHORS.has(id)
  );
  const scheduled = executableTaskIds([...scheduledTasks("checks"), ...scheduledTasks("browser")]);
  expect([...new Set(scheduled)].sort()).toEqual([...new Set(aggregate)].sort());
}, 30_000);

it("schedules every publish gate through the ci:checks aggregate", () => {
  // The release engine runs these gates before it publishes. A local `pnpm ci:checks` fans out
  // to them directly or through the `check` gate it includes.
  expect([...PUBLISH_GATES]).toEqual(["package:check", "test:packed-consumer"]);
  const scheduled = executableTaskIds(resolvedTasks(["run", "ci:checks"]));
  for (const gate of PUBLISH_GATES) {
    expect(scheduled, `${gate} must also run in the ci:checks aggregate`).toContain(
      `@elmeragroup/fuse#${gate}`
    );
  }
}, 30_000);

it("the local check gate is ci:checks without the e2e and packed-artifact tier", () => {
  // Unit under test: turbo.json's `check` aggregate. Oracle: the resolved ci:checks graph minus
  // the tasks this list names, which CI alone runs. Fuse's no-op aggregate anchors are not gates.
  // `build:e2e` is the build only `docs#test:e2e` serves (apps/docs/turbo.json), and `pack` the
  // tarball only the packed-artifact tier reads.
  const ciOnly = ["test:e2e", "build:e2e", "test:packed-consumer", "package:check", "pack"];
  const gates = (/** @type {string} */ aggregate) =>
    new Set(executableTaskIds(resolvedTasks(["run", aggregate])).filter((id) => !AGGREGATE_ANCHORS.has(id)));
  const full = gates("ci:checks");
  const local = gates("check");
  for (const task of ciOnly) {
    expect(
      [...full].some((id) => id.endsWith(`#${task}`)),
      `ci:checks must still run ${task}`
    ).toBe(true);
  }
  const expected = [...full].filter((id) => !ciOnly.some((task) => id.endsWith(`#${task}`)));
  expect([...local].sort()).toEqual(expected.sort());
}, 60_000);

/** @type {Map<string, string[]> | undefined} */
let testGraph;

/**
 * Each task's direct dependencies in the `turbo run test` graph, resolved once per file.
 * @param {string} taskId
 * @returns {string[]}
 */
function testDependencies(taskId) {
  testGraph ??= new Map(
    turboTasks(["run", "test"]).map((task) => [
      asString(task.taskId, "task id"),
      Array.isArray(task.dependencies) ? task.dependencies.map((entry) => asString(entry, "dependency")) : [],
    ])
  );
  const dependencies = testGraph.get(taskId);
  if (dependencies === undefined) throw new Error(`${taskId} is not in the test graph`);
  return dependencies;
}

/**
 * Whether a task in the `turbo run test` graph transitively depends on @elmeragroup/fuse#build.
 * @param {string} taskId
 * @param {Set<string>} [seen]
 * @returns {boolean}
 */
function reachesFuseBuild(taskId, seen = new Set()) {
  if (seen.has(taskId)) return false;
  seen.add(taskId);
  return testDependencies(taskId).some(
    (dependency) => dependency === "@elmeragroup/fuse#build" || reachesFuseBuild(dependency, seen)
  );
}

it("builds @elmeragroup/fuse before the Fuse and app test tasks, including the app overrides", () => {
  // The root `test.dependsOn` names @elmeragroup/fuse#build, but both apps replace the array
  // with their own `["build"]`; the density tripwires then rely on the transitive edge.
  // @elmeragroup/color opts out deliberately; the next test pins that.
  for (const taskId of ["@elmeragroup/fuse#test", "docs#test", "static-theme#test"]) {
    expect(reachesFuseBuild(taskId), `${taskId} must transitively build @elmeragroup/fuse`).toBe(true);
  }
}, 30_000);

it("runs the color package's unit tests without waiting on any other task", () => {
  // packages/color/turbo.json clears the root test edge to @elmeragroup/fuse#build, because
  // the color suites read only src/. Any edge would re-serialize them behind other work; the
  // reachability check names the Fuse build as the regression that matters most.
  expect(
    reachesFuseBuild("@elmeragroup/color#test"),
    "@elmeragroup/color#test must not wait for the Fuse build"
  ).toBe(false);
  expect(testDependencies("@elmeragroup/color#test")).toEqual([]);
}, 30_000);

it("runs docs build before type-check, not against the same .next", () => {
  const tasks = scheduledTasks("checks");
  const task = asRecord(
    tasks.find((entry) => entry.taskId === "docs#type-check"),
    "docs#type-check"
  );
  const dependencies = task.dependencies;
  if (!Array.isArray(dependencies)) {
    throw new Error("docs#type-check dependencies is not an array");
  }
  // `next build` deletes everything in .next except cache/dev/lock/trace before it
  // compiles, while `next typegen` creates .next/types and then writes into it. With no
  // edge between the two tasks, the build's clean can land in that window and typegen
  // dies with ENOENT on routes.d.ts (merge run 34702372072). One edge removes the race.
  expect(dependencies).toContain("docs#build");
});

it("the browser job schedules the browser, e2e and packed-consumer gates", () => {
  // The required gate inventory is independent of the workflow's task arguments and filters.
  const ids = executableTaskIds(scheduledTasks("browser")).filter((id) => BROWSER_JOB_GATE.test(id));
  expect([...new Set(ids)].sort()).toEqual([
    "@elmeragroup/fuse#test:browser",
    "@elmeragroup/fuse#test:packed-consumer",
    "@elmeragroup/fuse-figma#test:browser",
    "@elmeragroup/pr-shots#test:e2e",
    "docs#test:e2e",
    "static-theme#test:browser",
  ]);
}, 30_000);
