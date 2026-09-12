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

  it("requires changesets for ordinary PRs, exempting only the exact no-changeset label", () => {
    const step = requiredRunStep(requiredJobSteps(workflow, "checks"), "pnpm exec changeset status");
    expect(step.run).toBe("pnpm exec changeset status --since=origin/${{ github.base_ref }}");
    // This complete predicate is the policy contract. Substring checks also pass for
    // disabled steps, inverted exemptions, and conditions on an unrelated step.
    expect(asString(step.if, "changeset condition").replace(/\s+/g, " ").trim()).toBe(
      "${{ github.event_name == 'pull_request' && !contains(github.event.pull_request.labels.*.name, 'no-changeset') }}"
    );
  });
});
