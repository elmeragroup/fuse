import { describe, expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import { readWorkflow, requiredJobSteps, requiredRunStep } from "./workflow.mjs";

/** Both release jobs run only for a push to main once publishing is activated. */
const activatedPush =
  "github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.RELEASE_ENABLED == 'true'";

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

  it("validates the stable release PR in the merge checks", () => {
    // Moved here from release-workflow.test.mjs so the merge job's step predicates live in one
    // place; the hoisted env predicate itself is asserted in the changesets test below.
    const step = requiredRunStep(requiredJobSteps(workflow, "checks"), "pnpm release check-pr");
    expect(step.run).toBe("pnpm release check-pr");
    expect(step.if).toBe(
      "env.IS_SELF_RELEASE_PR == 'true' || github.ref == 'refs/heads/changeset-release/main'"
    );
  });

  it("runs on pull requests and pushes to main", () => {
    const events = asRecord(workflow.on, "merge events");
    expect(Object.hasOwn(events, "pull_request")).toBe(true);
    expect(events.pull_request).toBeNull();
    expect(asRecord(events.push, "push trigger")).toEqual({ branches: ["main"] });
    expect(Object.hasOwn(events, "workflow_dispatch")).toBe(true);
  });

  it("requires changesets for ordinary PRs, exempting only the bot release branch and the no-changeset label", () => {
    const checks = asRecord(asRecord(workflow.jobs, "merge jobs").checks, "checks job");
    // The hoisted predicate is shared by the changeset gate (negated) and the validate step;
    // it is the policy contract. GitHub stringifies the value, so both gates compare it to
    // 'true' explicitly. Substring checks also pass for disabled or inverted steps.
    // The changesets/action bot cannot label its own PR, so its branch is exempt by name and repository.
    expect(asString(asRecord(checks.env, "checks env").IS_SELF_RELEASE_PR, "self release predicate")).toBe(
      "${{ github.head_ref == 'changeset-release/main' && github.event.pull_request.head.repo.full_name == github.repository }}"
    );
    const step = requiredRunStep(requiredJobSteps(workflow, "checks"), "pnpm exec changeset status");
    expect(step.run).toBe("pnpm exec changeset status --since=origin/${{ github.base_ref }}");
    expect(asString(step.if, "changeset condition").replace(/\s+/g, " ").trim()).toBe(
      "${{ github.event_name == 'pull_request' && env.IS_SELF_RELEASE_PR != 'true' && !contains(github.event.pull_request.labels.*.name, 'no-changeset') }}"
    );
  });

  it("publishes and prepares the version PR only from an activated push to main", () => {
    const jobs = asRecord(workflow.jobs, "merge jobs");
    const release = asRecord(jobs.release, "release job");
    expect(release.needs).toBe("checks");
    expect(release.if).toBe(activatedPush);
    expect(release.uses).toBe("./.github/workflows/publish-release.yml");
    // The called workflow cannot hold more than the caller grants; the engine records its
    // publication with `contents: write` and reads the release PR with `pull-requests: read`.
    expect(release.permissions).toEqual({ contents: "write", "pull-requests": "read" });
    // The job is skipped while RELEASE_ENABLED is unset, so dropped call wiring would stay
    // invisible until activation.
    const releaseWith = asRecord(release.with, "release with");
    expect(releaseWith.source_commit).toBe("${{ github.sha }}");
    const releaseSecrets = asRecord(release.secrets, "release secrets");
    expect(releaseSecrets.NPM_TOKEN).toBe("${{ secrets.NPM_TOKEN }}");
    const version = asRecord(jobs.version, "version job");
    expect(version.needs).toBe("checks");
    expect(version.if).toBe(activatedPush);
    expect(version.uses).toBe("./.github/workflows/version-packages.yml");
    // The version job writes the bot PR and dispatches merge.yml for its checks.
    expect(version.permissions).toEqual({
      contents: "write",
      "pull-requests": "write",
      actions: "write",
    });
  });
});
