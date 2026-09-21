import { expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import { readWorkflow, requiredJobSteps, requiredRunStep, turboTasks } from "./workflow.mjs";

/** @param {string} job */
function turboRunStep(job) {
  const step = requiredRunStep(requiredJobSteps(readWorkflow("merge"), job), "pnpm exec turbo run ");
  expect(step.if, `${job} gate must not be conditional`).toBeUndefined();
  return step;
}

/**
 * The task names a job's turbo command requests, before Turbo resolves them.
 * @param {string} job
 */
function requestedTasks(job) {
  const command = asString(turboRunStep(job).run, `${job} command`);
  const tokens = (command.match(/'[^']*'|"[^"]*"|\S+/g) ?? []).map((token) =>
    token.replace(/^['"]|['"]$/g, "")
  );
  return tokens.slice(4);
}

/** @param {string} job */
function scheduledTasks(job) {
  return turboTasks(["run", ...requestedTasks(job)]);
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
  // The checks job runs explicit task names because it must exclude the browser gates; a
  // task added to one list and not the other would silently run on no PR, so pin the split
  // against the aggregate Turbo resolves rather than against a hand-copied second list.
  const tasks = turboTasks(["run", "ci:checks"]);
  const fuseChecks = asRecord(
    tasks.find((task) => task.taskId === "@elmeragroup/fuse#ci:checks"),
    "@elmeragroup/fuse#ci:checks"
  );
  const dependsOn = asRecord(fuseChecks.resolvedTaskDefinition, "resolved task definition").dependsOn;
  if (!Array.isArray(dependsOn)) throw new Error("ci:checks dependsOn is not an array");
  const names = dependsOn.map((entry) => asString(entry, "ci:checks dependency"));
  const scheduled = [...requestedTasks("checks"), ...requestedTasks("browser")];
  expect([...scheduled].sort()).toEqual([...names].sort());
}, 30_000);

it("builds @elmeragroup/fuse before every test task, including the app overrides", () => {
  // The root `test.dependsOn` names @elmeragroup/fuse#build, but both apps replace the array
  // with their own `["build"]`; the density tripwires then rely on the transitive edge.
  const tasks = turboTasks(["run", "test"]);
  const dependenciesById = new Map(
    tasks.map((task) => [
      asString(task.taskId, "task id"),
      Array.isArray(task.dependencies) ? task.dependencies.map((entry) => asString(entry, "dependency")) : [],
    ])
  );
  /**
   * @param {string} taskId
   * @returns {boolean}
   */
  const reachesFuseBuild = (taskId) => {
    const seen = new Set();
    /**
     * @param {string} currentId
     * @returns {boolean}
     */
    const walk = (currentId) => {
      if (seen.has(currentId)) return false;
      seen.add(currentId);
      for (const dependency of dependenciesById.get(currentId) ?? []) {
        if (dependency === "@elmeragroup/fuse#build" || walk(dependency)) return true;
      }
      return false;
    };
    return walk(taskId);
  };

  for (const taskId of ["@elmeragroup/fuse#test", "docs#test", "static-theme#test"]) {
    expect(reachesFuseBuild(taskId), `${taskId} must transitively build @elmeragroup/fuse`).toBe(true);
  }
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
  const ids = scheduledTasks("browser").map((task) => asString(task.taskId, "task id"));
  for (const required of [
    "@elmeragroup/fuse#test:browser",
    "@elmeragroup/fuse#test:packed-consumer",
    "docs#test:browser",
    "static-theme#test:browser",
  ]) {
    expect(ids).toContain(required);
  }
}, 30_000);
