import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { parse } from "yaml";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";

/** Repository root, shared by the workflow suites. */
export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Repository trees the source-level policy tests walk, shared by the guards that read source. */
export const SOURCE_TREES = ["apps", "packages", "scripts", "tooling", "test"];

/** The JS/TS file kinds the source-level policy tests read. */
export const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/;

/**
 * Renders an absolute path relative to the repository root, with forward slashes.
 *
 * @param {string} path - Absolute path inside the repository.
 * @returns {string} The repository-relative POSIX path.
 */
export function repoRelativePath(path) {
  return relative(repoRoot, path).split(sep).join("/");
}

/** Directory names the shared file walker never descends into. */
const SKIPPED_DIRECTORY_NAMES = new Set(["node_modules", "dist", "generated"]);

/**
 * Collects the absolute paths of every file under `directory` whose basename `matches`, skipping
 * `node_modules`, `dist`, `generated` and dot-entries.
 *
 * @param {string} directory - Absolute directory to walk.
 * @param {(name: string) => boolean} matches - Predicate over a file's basename.
 * @returns {string[]} Absolute paths of matching files.
 */
export function findFiles(directory, matches) {
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORY_NAMES.has(entry.name) || entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findFiles(path, matches));
    else if (matches(entry.name)) found.push(path);
  }
  return found;
}

/** @param {string} name */
export function readWorkflow(name) {
  return asRecord(
    parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8")),
    name
  );
}

/**
 * Resolves the given Turbo arguments with `--dry=json` and returns the scheduled tasks.
 * @param {string[]} args
 * @returns {Record<string, unknown>[]}
 */
export function turboTasks(args) {
  const graphText = execFileSync(join(repoRoot, "node_modules/.bin/turbo"), [...args, "--dry=json"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  // SAFETY: the graph is Turbo's JSON protocol, validated before inspecting its tasks.
  const graph = asRecord(JSON.parse(graphText), "Turbo graph");
  return asRecordArray(graph.tasks, "Turbo tasks");
}

/**
 * @param {Record<string, unknown>} workflow
 * @param {string} name
 */
export function jobSteps(workflow, name) {
  const job = asRecord(asRecord(workflow.jobs, "workflow jobs")[name], name);
  return asRecordArray(job.steps, `${name} steps`);
}

/**
 * @param {Record<string, unknown>} workflow
 * @param {string} name
 */
export function requiredJobSteps(workflow, name) {
  const job = asRecord(asRecord(workflow.jobs, "workflow jobs")[name], name);
  expect(job.if, `${name} must run for every workflow event`).toBeUndefined();
  expect(job["continue-on-error"]).toBeUndefined();
  return jobSteps(workflow, name);
}

/**
 * @param {Record<string, unknown>[]} steps
 * @param {string} prefix
 */
export function requiredRunStep(steps, prefix) {
  const matches = steps.filter(
    (step) => step.run !== undefined && asString(step.run, "step run").trim().startsWith(prefix)
  );
  expect(matches, `expected one executable ${prefix} step`).toHaveLength(1);
  const step = matches[0];
  expect(step["continue-on-error"]).toBeUndefined();
  return step;
}
