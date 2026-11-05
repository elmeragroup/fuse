import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString, isPlainObject, isString } from "./json-object.mjs";
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

/**
 * Every place a parsed workflow touches secrets, as `path: value`: each string that mentions the
 * `secrets` context, and each `secrets:` declaration, written as its keys or, for a reusable
 * workflow call, as `inherit`. A step in a list is named by its `id`, so the path survives renames
 * and reordering; a step without one is named by its position.
 * @param {unknown} value
 * @param {string} path
 * @returns {string[]}
 */
function secretReferences(value, path) {
  if (isString(value)) return /\bsecrets\b/.test(value) ? [`${path}: ${value}`] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const id = isPlainObject(item) && isString(item.id) ? item.id : `#${String(index)}`;
      return secretReferences(item, `${path}[${id}]`);
    });
  }
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const at = path === "" ? key : `${path}.${key}`;
    if (key !== "secrets") return secretReferences(item, at);
    const declared = isPlainObject(item) ? `{${Object.keys(item).sort().join(", ")}}` : String(item);
    return [`${at}: ${declared}`, ...secretReferences(item, at)];
  });
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

  it("references secrets only in the fields allowed to, across every workflow", () => {
    // Each permitted reference, by workflow, job, step id and field. Display names, step order
    // and other steps are free to change; a new reference to any secret anywhere fails here, so a
    // token cannot reach a job or step it was not meant for.
    const allowed = [
      // The one secret merge.yml passes to the called workflow, by name; never `inherit`.
      "merge.yml jobs.release.secrets: {SLACK_BOT_TOKEN}",
      "merge.yml jobs.release.secrets.SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}",
      "publish-release.yml on.workflow_call.secrets: {SLACK_BOT_TOKEN}",
      // Only the step that announces holds the token; the install before it does not.
      "publish-release.yml jobs.notify.steps[announce].env.SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}",
    ];
    const found = workflowNames().flatMap((name) =>
      secretReferences(readWorkflow(name), "").map((reference) => `${name}.yml ${reference}`)
    );
    expect(found.sort()).toEqual([...allowed].sort());
  });
});
