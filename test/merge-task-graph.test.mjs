import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { readWorkflow, requiredJobSteps, requiredRunStep } from "./workflow.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} job */
function scheduledTasks(job) {
  const step = requiredRunStep(requiredJobSteps(readWorkflow("merge"), job), "pnpm exec turbo run ");
  expect(step.if, `${job} gate must not be conditional`).toBeUndefined();
  const command = asString(step.run, `${job} command`);
  const tokens = command.match(/'[^']*'|"[^"]*"|\S+/g).map((token) => token.replace(/^['"]|['"]$/g, ""));
  const graphText = execFileSync(
    join(repoRoot, "node_modules/.bin/turbo"),
    [...tokens.slice(3), "--dry=json"],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  // SAFETY: the graph is Turbo's JSON protocol, validated before inspecting its tasks.
  const graph = asRecord(JSON.parse(graphText), "Turbo graph");
  return asRecordArray(graph.tasks, "Turbo tasks");
}

it("the merge checks schedule all required gates without browser work", () => {
  const ids = scheduledTasks("checks").map((task) => asString(task.taskId, "task id"));
  for (const required of [
    "//#lint",
    "//#test:repo-policy",
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
