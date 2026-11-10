import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { parse } from "yaml";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

/** The directory every GitHub Actions workflow lives in. */
const WORKFLOW_DIRECTORY = new URL("../.github/workflows/", import.meta.url);

/**
 * Reads a workflow's raw YAML, for checks on comments the parser drops.
 *
 * @param {string} name - Workflow file name without the `.yml` extension.
 * @returns {string} The workflow source text.
 */
function readWorkflowText(name) {
  return readFileSync(new URL(`${name}.yml`, WORKFLOW_DIRECTORY), "utf8");
}

/** @param {string} name */
export function readWorkflow(name) {
  return asRecord(parse(readWorkflowText(name)), name);
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
export function requiredJobSteps(workflow, name) {
  const job = asRecord(asRecord(workflow.jobs, "workflow jobs")[name], name);
  expect(job.if, `${name} must run for every workflow event`).toBeUndefined();
  expect(job["continue-on-error"]).toBeUndefined();
  return asRecordArray(job.steps, `${name} steps`);
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
