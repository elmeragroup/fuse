import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString, isPlainObject } from "./json-object.mjs";
import { compositeActions, readWorkflow, resolveMatrixExpressions, workflowNames } from "./workflow.mjs";

/** Workflow and local composite-action steps, with the site each failure should name. */
function workflowSteps() {
  const workflows = workflowNames().flatMap((name) => {
    const workflow = readWorkflow(name);
    return Object.entries(asRecord(workflow.jobs, `${name} jobs`)).flatMap(([job, value]) => {
      const configuration = asRecord(value, job);
      const steps = configuration.steps;
      if (steps === undefined) return [];
      return asRecordArray(steps, `${job} steps`).map((step) => ({
        site: `${name}.yml ${job}`,
        step,
        job: configuration,
      }));
    });
  });
  return [
    ...workflows,
    ...compositeActions().flatMap(({ name, steps }) =>
      steps.map((step) => ({ site: name, step, job: undefined }))
    ),
  ];
}

// An expression inside `run:` is spliced into the script before the shell parses it, so a
// value with quotes or `$(...)` becomes code. Dynamic values reach scripts through `env`;
// only references resolved to literal values in every entry of an include-only matrix may be spliced in.
describe("workflow hardening", () => {
  it("keeps dynamic GitHub expressions out of every run script", () => {
    const offenders = workflowSteps()
      .filter(({ site, step, job }) => {
        if (step.run === undefined) return false;
        const run = asString(step.run, `${site} run`);
        if (!/\$\{\{\s*matrix\./.test(run)) return run.includes("${{");
        const strategy = job?.strategy;
        if (!isPlainObject(strategy)) return true;
        const matrix = strategy.matrix;
        if (
          !isPlainObject(matrix) ||
          !Array.isArray(matrix.include) ||
          matrix.include.length === 0 ||
          Object.keys(matrix).some((key) => key !== "include")
        ) {
          return true;
        }
        return matrix.include.some(
          (entry) => !isPlainObject(entry) || resolveMatrixExpressions(run, entry).includes("${{")
        );
      })
      .map(({ site, step }) => `${site}: ${String(step.name ?? step.run)}`);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("leaves no token on disk after any checkout", () => {
    // A persisted token is readable by every later step, including installed dependency code.
    const offenders = workflowSteps()
      .filter(({ site, step }) => {
        if (step.uses === undefined || !asString(step.uses, `${site} uses`).startsWith("actions/checkout@")) {
          return false;
        }
        const withInput = step.with === undefined ? {} : asRecord(step.with, `${site} checkout with`);
        return withInput["persist-credentials"] !== false;
      })
      .map(({ site }) => site);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
