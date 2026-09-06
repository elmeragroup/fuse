import { describe, expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import { readWorkflow, requiredJobSteps, requiredRunStep } from "./workflow.mjs";

describe("merge workflow", () => {
  const workflow = readWorkflow("merge");

  it("runs formatting and installs Chromium in their required jobs", () => {
    const checks = requiredJobSteps(workflow, "checks");
    const format = requiredRunStep(checks, "pnpm exec oxfmt");
    expect(format.if).toBeUndefined();
    expect(format.run).toBe("pnpm exec oxfmt --check");

    const browser = requiredJobSteps(workflow, "browser");
    const install = requiredRunStep(browser, "pnpm --filter @elmeragroup/ui exec playwright");
    expect(install.if).toBeUndefined();
    expect(install.run).toBe("pnpm --filter @elmeragroup/ui exec playwright install --with-deps chromium");
    const gate = requiredRunStep(browser, "pnpm exec turbo run ");
    expect(browser.indexOf(install)).toBeLessThan(browser.indexOf(gate));
  });

  it("runs on pull requests and pushes to main", () => {
    const events = asRecord(workflow.on, "merge events");
    expect(Object.hasOwn(events, "pull_request")).toBe(true);
    expect(events.pull_request).toBeNull();
    expect(asRecord(events.push, "push trigger")).toEqual({ branches: ["main"] });
  });

  it("requires changesets for ordinary PRs, exempting only release branches and the exact label", () => {
    const step = requiredRunStep(requiredJobSteps(workflow, "checks"), "pnpm exec changeset status");
    expect(step.run).toBe("pnpm exec changeset status --since=origin/${{ github.base_ref }}");
    // This complete predicate is the policy contract. Substring checks also pass for
    // disabled steps, inverted exemptions, and conditions on an unrelated step.
    expect(asString(step.if, "changeset condition").replace(/\s+/g, " ").trim()).toBe(
      "${{ github.event_name == 'pull_request' && !startsWith(github.head_ref, 'changeset-release/') && !contains(github.event.pull_request.labels.*.name, 'no-changeset') }}"
    );
  });

  it("opens a Version Packages PR from main without configuring publication", () => {
    const version = readWorkflow("version-packages");
    expect(version.on).toEqual({ push: { branches: ["main"] } });
    const steps = requiredJobSteps(version, "version");
    const actions = steps.filter(
      (step) => step.uses !== undefined && asString(step.uses, "action").startsWith("changesets/action@")
    );
    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action.if).toBeUndefined();
    expect(action["continue-on-error"]).toBeUndefined();
    const inputs = asRecord(action.with, "changesets inputs");
    expect(inputs.version).toBe("pnpm exec changeset version");
    expect(inputs.publish).toBeUndefined();
    for (const step of steps) {
      if (step.run !== undefined)
        expect(asString(step.run, "version command")).not.toMatch(/\b(?:npm|pnpm)\s+publish\b/);
    }
  });
});
