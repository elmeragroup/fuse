import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { readWorkflow, readWorkflowText, workflowNames } from "./workflow.mjs";

// Parsed workflows are the only gate that sees every `uses` ref: oxlint reads no YAML, and the
// per-workflow tests look up only the steps they assert on, so an unguarded step could drift back
// to a tag. This sweep owns the pin rule for every job and step instead.

/** A reusable workflow in this repository, the only local ref form in use. */
const LOCAL_WORKFLOW = /^\.\/\.github\/workflows\/[\w.-]+\.yml$/;

/** A third-party action pinned to a full commit SHA. */
const PINNED_ACTION = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;

/** A raw `uses:` line and its value, at job or step level. */
const USES_LINE = /^\s*(?:-\s+)?uses:\s*(\S+)/;

/**
 * The version comment Dependabot rewrites alongside the SHA; it only recognises this exact form.
 */
const VERSION_COMMENT = / # v\d+\.\d+\.\d+$/;

/**
 * Collects every job-level and step-level `uses` ref in one parsed workflow.
 *
 * @param {Record<string, unknown>} workflow - The parsed workflow.
 * @returns {{ site: string, ref: string }[]} Each ref with its site, `job` or `job step N`.
 */
function usesRefs(workflow) {
  return Object.entries(asRecord(workflow.jobs, "workflow jobs")).flatMap(([name, value]) => {
    const job = asRecord(value, name);
    const jobRefs = job.uses === undefined ? [] : [{ site: name, ref: asString(job.uses, `${name} uses`) }];
    const steps = job.steps === undefined ? [] : asRecordArray(job.steps, `${name} steps`);
    const stepRefs = steps.flatMap((step, index) =>
      step.uses === undefined
        ? []
        : [{ site: `${name} step ${String(index + 1)}`, ref: asString(step.uses, `${name} step uses`) }]
    );
    return [...jobRefs, ...stepRefs];
  });
}

describe("action pins", () => {
  it("pins every third-party action to a commit SHA", () => {
    const offenders = workflowNames().flatMap((name) =>
      usesRefs(readWorkflow(name))
        .filter(({ ref }) => !LOCAL_WORKFLOW.test(ref) && !PINNED_ACTION.test(ref))
        .map(({ site, ref }) => `${name}.yml ${site}: ${ref}`)
    );
    expect(offenders, `every uses ref is local or owner/path@<40-hex>\n${offenders.join("\n")}`).toEqual([]);
  });

  it("marks every pinned action with its version comment", () => {
    const offenders = workflowNames().flatMap((name) =>
      readWorkflowText(name)
        .split("\n")
        .flatMap((line, index) => {
          const match = USES_LINE.exec(line);
          if (match === null || LOCAL_WORKFLOW.test(match[1]) || VERSION_COMMENT.test(line)) return [];
          return [`${name}.yml:${String(index + 1)} ${line.trim()}`];
        })
    );
    expect(offenders, `every pinned uses line ends in \`# vX.Y.Z\`\n${offenders.join("\n")}`).toEqual([]);
  });
});
