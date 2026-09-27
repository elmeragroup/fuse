import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { readWorkflow, workflowNames } from "./workflow.mjs";

// An expression inside `run:` is spliced into the script before the shell parses it, so a
// value with quotes or `$(...)` becomes code. Every value reaches scripts through `env` instead.
describe("workflow hardening", () => {
  it("keeps GitHub expressions out of every run script", () => {
    const offenders = workflowNames().flatMap((name) =>
      Object.entries(asRecord(readWorkflow(name).jobs, `${name} jobs`)).flatMap(([job, value]) => {
        const steps = asRecord(value, job).steps;
        if (steps === undefined) return [];
        return asRecordArray(steps, `${job} steps`)
          .filter((step) => step.run !== undefined && asString(step.run, `${job} run`).includes("${{"))
          .map((step) => `${name}.yml ${job}: ${String(step.name ?? step.run)}`);
      })
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
