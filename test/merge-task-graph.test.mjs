import { expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import { readWorkflow, requiredJobSteps, requiredRunStep, turboTasks } from "./workflow.mjs";

/** @param {string} job */
function scheduledTasks(job) {
  const step = requiredRunStep(requiredJobSteps(readWorkflow("merge"), job), "pnpm exec turbo run ");
  expect(step.if, `${job} gate must not be conditional`).toBeUndefined();
  const command = asString(step.run, `${job} command`);
  const tokens = command.match(/'[^']*'|"[^"]*"|\S+/g).map((token) => token.replace(/^['"]|['"]$/g, ""));
  return turboTasks(tokens.slice(3));
}

it("the merge checks schedule all required gates without browser work", () => {
  const ids = scheduledTasks("checks").map((task) => asString(task.taskId, "task id"));
  for (const required of [
    "//#lint",
    "//#test:repo-policy",
    "//#type-check:scripts",
    "@elmeragroup/ui#build",
    "@elmeragroup/ui#type-check",
    "@elmeragroup/ui#test",
    "@elmeragroup/ui#test:types",
    "@elmeragroup/ui#package:check",
    "@elmeragroup/ui#size-limit",
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
    "@elmeragroup/ui#test:browser",
    "@elmeragroup/ui#test:packed-consumer",
    "docs#test:browser",
    "static-theme#test:browser",
  ]) {
    expect(ids).toContain(required);
  }
}, 30_000);
