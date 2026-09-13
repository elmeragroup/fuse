import { readFileSync } from "node:fs";
import { expect } from "vitest";
import { parse } from "yaml";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";

/** @param {string} name */
export function readWorkflow(name) {
  return asRecord(
    parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8")),
    name
  );
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
