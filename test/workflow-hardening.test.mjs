import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { readWorkflow, workflowNames } from "./workflow.mjs";

/** Every step of every job in every workflow, with its "<name>.yml <job>" site. */
function workflowSteps() {
  return workflowNames().flatMap((name) =>
    Object.entries(asRecord(readWorkflow(name).jobs, `${name} jobs`)).flatMap(([job, value]) => {
      const steps = asRecord(value, job).steps;
      if (steps === undefined) return [];
      return asRecordArray(steps, `${job} steps`).map((step) => ({ site: `${name}.yml ${job}`, step }));
    })
  );
}

// An expression inside `run:` is spliced into the script before the shell parses it, so a
// value with quotes or `$(...)` becomes code. Every value reaches scripts through `env` instead.
describe("workflow hardening", () => {
  it("keeps GitHub expressions out of every run script", () => {
    const offenders = workflowSteps()
      .filter(({ site, step }) => step.run !== undefined && asString(step.run, `${site} run`).includes("${{"))
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
