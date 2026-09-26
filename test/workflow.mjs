import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { parse } from "yaml";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

/** The directory every GitHub Actions workflow lives in. */
const WORKFLOW_DIRECTORY = new URL("../.github/workflows/", import.meta.url);

/**
 * Lists every workflow by the name `readWorkflow` and `readWorkflowText` take. GitHub also runs
 * `.yaml` files, so any other entry fails here instead of escaping the sweeps.
 *
 * @returns {string[]} Workflow file names without the `.yml` extension.
 */
export function workflowNames() {
  const files = readdirSync(WORKFLOW_DIRECTORY);
  expect(
    files.filter((file) => !file.endsWith(".yml")),
    "workflows use the .yml extension"
  ).toEqual([]);
  return files.map((file) => file.slice(0, -".yml".length));
}

/**
 * Reads a workflow's raw YAML, for checks on comments the parser drops.
 *
 * @param {string} name - Workflow file name without the `.yml` extension.
 * @returns {string} The workflow source text.
 */
export function readWorkflowText(name) {
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

/**
 * Finds the single step that runs `action` at any ref. The ref itself is the pin sweep's concern
 * (`action-pins.test.mjs`), so a second step with the same action fails here as a duplicate.
 * @param {Record<string, unknown>[]} steps
 * @param {string} action The action path without a ref, such as `actions/checkout`.
 */
export function requiredUsesStep(steps, action) {
  const matches = steps.filter(
    (step) => step.uses !== undefined && asString(step.uses, "step uses").startsWith(`${action}@`)
  );
  expect(matches, `expected one ${action} step`).toHaveLength(1);
  return matches[0];
}
