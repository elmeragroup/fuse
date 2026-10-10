import { expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import {
  jobMatrixEntries,
  readWorkflow,
  requiredJobSteps,
  requiredRunStep,
  resolveMatrixExpressions,
  turboTasks,
} from "./workflow.mjs";

/** @param {string} job */
function turboRunStep(job) {
  const step = requiredRunStep(requiredJobSteps(readWorkflow("merge"), job), "pnpm exec turbo run ");
  expect(step.if, `${job} gate must not be conditional`).toBeUndefined();
  return step;
}

/**
 * The arguments a job's turbo command requests, before Turbo resolves them.
 * @param {string} job
 * @param {Record<string, unknown>} [entry]
 */
function requestedArgs(job, entry = {}) {
  const command = resolveMatrixExpressions(asString(turboRunStep(job).run, `${job} command`), entry);
  expect(command, `${job} gate must be one resolved command`).not.toMatch(/\$\{\{|[\r\n]/);
  const tokens = (command.match(/(?:'[^']*'|"[^"]*"|[^\s'"]+)+/g) ?? []).map((token) =>
    token.replace(/['"]/g, "")
  );
  return tokens.slice(4);
}

/** @param {string} job */
function scheduledTasks(job) {
  return turboTasks(["run", ...requestedArgs(job)]);
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

/** @type {{ leg: string, args: string[], tasks: Record<string, unknown>[] }[] | undefined} */
let browserGraphs;

/** Each browser leg's command and resolved graph, including task passthrough arguments. */
function browserLegs() {
  browserGraphs ??= jobMatrixEntries(readWorkflow("merge"), "browser").map((entry) => {
    const args = requestedArgs("browser", entry);
    return { leg: asString(entry.leg, "browser leg"), args, tasks: turboTasks(["run", ...args]) };
  });
  return browserGraphs;
}

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
    "@elmeragroup/fuse#size-limit",
    "@elmeragroup/color#test",
    "@elmeragroup/color#type-check",
    "docs#build",
    "docs#type-check",
    "docs#test",
    "static-theme#build",
    "static-theme#type-check",
    "static-theme#test",
  ]) {
    expect(ids).toContain(required);
  }
  expect(ids.filter((id) => /#test:(browser|packed-consumer)$/.test(id))).toEqual([]);
  // The extractor and lint plugins ship in @elmeragroup/internal; no workspace package
  // carries their gates any more, so nothing under tooling/* other than the tsconfig
  // package may appear in the graph.
  expect(ids.filter((id) => /^@elmeragroup\/(api-extractor|oxlint-plugin)/.test(id))).toEqual([]);
}, 30_000);

it("splits the ci:checks aggregate exactly between the checks and browser jobs", () => {
  // Unit under test: merge's resolved job graphs. Oracle: turbo.json's ci:checks aggregate.
  // Shared builds and repeated docs shards count once; the aggregate's no-op anchor is not a gate.
  const aggregate = executableTaskIds(turboTasks(["run", "ci:checks"])).filter(
    (id) => !id.endsWith("#ci:checks")
  );
  const scheduled = executableTaskIds([
    ...scheduledTasks("checks"),
    ...browserLegs().flatMap((leg) => leg.tasks),
  ]);
  expect([...new Set(scheduled)].sort()).toEqual([...new Set(aggregate)].sort());
}, 30_000);

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

it("the browser job schedules the browser and packed-consumer gates", () => {
  // The required gate inventory is independent of the workflow's task arguments and filters.
  const ids = executableTaskIds(browserLegs().flatMap((leg) => leg.tasks)).filter((id) =>
    /#test:(browser|packed-consumer)$/.test(id)
  );
  expect([...new Set(ids)].sort()).toEqual([
    "@elmeragroup/fuse#test:browser",
    "@elmeragroup/fuse#test:packed-consumer",
    "@elmeragroup/pr-shots#test:browser",
    "docs#test:browser",
    "static-theme#test:browser",
  ]);
}, 30_000);

it("covers every docs browser shard exactly once and keeps package gates unsharded", () => {
  const legs = browserLegs();
  expect(legs.map((leg) => leg.leg).sort()).toEqual(["docs-1", "docs-2", "docs-3", "docs-4", "packages"]);
  const docs = legs.filter((leg) => leg.tasks.some((task) => task.taskId === "docs#test:browser"));
  expect(docs).toHaveLength(4);
  for (const leg of docs) {
    const gates = executableTaskIds(leg.tasks).filter((id) => /#test:(browser|packed-consumer)$/.test(id));
    expect(gates, `${leg.leg} must only shard the docs browser gate`).toEqual(["docs#test:browser"]);
    expect(leg.args.slice(leg.args.indexOf("--") + 1), `${leg.leg} shard arguments`).toHaveLength(1);
  }
  // N executions must cover 1/N through N/N, even though their resolved task ids are identical.
  const shards = docs.map((leg) => leg.args.slice(leg.args.indexOf("--") + 1)[0]);
  expect(shards.sort()).toEqual(
    Array.from({ length: docs.length }, (_, index) => `--shard=${index + 1}/${docs.length}`)
  );
  for (const leg of legs.filter((candidate) => !docs.includes(candidate))) {
    expect(leg.args, `${leg.leg} must not forward shard arguments to package gates`).not.toContain("--");
    expect(leg.args.some((arg) => arg.startsWith("--shard"))).toBe(false);
  }
}, 30_000);
