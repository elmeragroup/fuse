import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import { asRecord, asRecordArray, asString, readJsonObject } from "./json-object.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

it("the actual merge command schedules all private extractor gates without browser work", () => {
  const workflow = readFileSync(join(repoRoot, ".github/workflows/merge.yml"), "utf8");
  const checks = workflow.split(/^  browser:/m)[0];
  const command = /^\s+run: (pnpm exec turbo run .+)$/m.exec(checks)?.[1];
  expect(command, "nonbrowser workflow must have an executable Turbo gate command").toBeDefined();
  const tokens = command.match(/'[^']*'|"[^"]*"|\S+/g).map((token) => token.replace(/^['"]|['"]$/g, ""));
  const graphText = execFileSync(
    join(repoRoot, "node_modules/.bin/turbo"),
    [...tokens.slice(3), "--dry=json"],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  // SAFETY: the graph is Turbo's JSON protocol, validated before inspecting its tasks.
  const graph = asRecord(JSON.parse(graphText), "Turbo graph");
  const tasks = asRecordArray(graph.tasks, "Turbo tasks");
  const ids = tasks.map((task) => asString(task.taskId, "task id"));
  expect(ids).toContain("@elmeragroup/api-extractor#ci:checks");
  expect(ids).toContain("@elmeragroup/api-extractor#test");
  expect(ids).toContain("@elmeragroup/api-extractor#type-check");
  expect(ids.filter((id) => /#test:(browser|packed-consumer)$/.test(id))).toEqual([]);
  const leaf = tasks.find((task) => task.taskId === "@elmeragroup/api-extractor#ci:checks");
  const manifest = readJsonObject(join(repoRoot, "tooling/api-extractor/package.json"));
  const scripts = asRecord(manifest.scripts, "extractor scripts");
  expect(leaf.dependencies).toContain("@elmeragroup/api-extractor#build");
  expect(leaf.command).toBe(scripts["ci:checks"]);
  const privateGates = asString(scripts["ci:checks"], "extractor private command")
    .split(/\s*&&\s*/)
    .map((command) => command.replace(/^pnpm run /, ""));
  expect(privateGates).toEqual([
    "check:catalog",
    "check:boundary",
    "test:fixtures",
    "test:conformance",
    "test:timing",
    "test:timing:issue14",
    "test:timing:external-selection",
  ]);
  for (const gate of privateGates) expect(asString(scripts[gate], gate).length).toBeGreaterThan(0);
}, 30_000);

it("the local ci aggregate retains extractor unit, type and private checks", () => {
  const output = execFileSync(join(repoRoot, "node_modules/.bin/turbo"), ["run", "ci:checks", "--dry=json"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  // SAFETY: Turbo JSON is validated before inspecting task records.
  const graph = asRecord(JSON.parse(output), "aggregate graph");
  const tasks = asRecordArray(graph.tasks, "aggregate tasks");
  const ids = tasks.map((task) => asString(task.taskId, "task id"));
  for (const task of ["build", "test", "type-check", "ci:checks"]) {
    expect(ids).toContain(`@elmeragroup/api-extractor#${task}`);
  }
}, 30_000);
