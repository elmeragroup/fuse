import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import { jobSteps, readWorkflow, requiredJobSteps, requiredRunStep } from "./workflow.mjs";

describe("version workflow", () => {
  const workflow = readWorkflow("version-packages");

  it("versions through the root script and triggers the release PR checks", () => {
    // Checks can finish out of push order. An older job must neither cancel a running update
    // nor replace a queued one; the job checks main again before it writes the release branch.
    const job = asRecord(asRecord(workflow.jobs, "version jobs").version, "version job");
    // The job writes the bot PR and dispatches merge.yml for its checks; a dropped grant would
    // stay invisible until activation.
    expect(job.permissions).toEqual({ contents: "write", "pull-requests": "write", actions: "write" });
    const concurrency = asRecord(job.concurrency, "version concurrency");
    expect(asString(concurrency.group, "concurrency group")).toBe("version-packages");
    expect(concurrency["cancel-in-progress"]).toBe(false);
    expect(concurrency.queue).toBe("max");
    const steps = requiredJobSteps(workflow, "version");
    const action = steps.find((step) => step.uses === "changesets/action@v2");
    if (action === undefined) throw new Error("version job does not use changesets/action@v2");
    const guard = steps.find((step) => step.id === "current-main");
    if (guard === undefined) throw new Error("version job does not check the current main commit");
    expect(guard.if).toBeUndefined();
    expect(guard["continue-on-error"]).toBeUndefined();
    expect(guard.env).toEqual({ GH_TOKEN: "${{ github.token }}" });
    expect(steps.indexOf(guard)).toBeLessThan(steps.indexOf(action));
    expect(action.if).toBe("steps.current-main.outputs.current == 'true'");
    const withInput = asRecord(action.with, "changesets action inputs");
    expect(withInput["version-script"]).toBe("pnpm release:version");
    // The release engine is the only publisher; a `publish-script` would bypass its records and gates.
    expect(withInput["publish-script"]).toBeUndefined();
    const dispatch = requiredRunStep(steps, "gh workflow run merge.yml");
    expect(dispatch.if).toBe("steps.changesets.outputs.pr-number");
  });

  it.each([
    { name: "allows the current main commit", main: "a", status: 0, current: true },
    { name: "skips an older commit whose checks finish last", main: "b", status: 0, current: false },
    { name: "fails closed when GitHub cannot return main", main: "a", status: 1, current: false },
  ])("$name", ({ main, status, current }) => {
    const guard = jobSteps(workflow, "version").find((step) => step.id === "current-main");
    if (guard === undefined) throw new Error("version job does not check the current main commit");
    const scratch = mkdtempSync(join(tmpdir(), "elmera-version-workflow-"));
    const output = join(scratch, "output");
    const args = join(scratch, "gh-args");
    try {
      // Execute the actual workflow shell step with only GitHub's transport replaced. A failed
      // lookup deliberately prints the matching SHA too: its failure must still prevent a write.
      const result = spawnSync(
        "bash",
        [
          "-e",
          "-o",
          "pipefail",
          "-c",
          `gh() {
            printf '%s\\n' "$*" > "$TEST_GH_ARGS"
            printf '%s\\n' "$TEST_MAIN_SHA"
            return "$TEST_GH_STATUS"
          }
          ${asString(guard.run, "freshness check")}`,
        ],
        {
          encoding: "utf8",
          timeout: 5_000,
          env: {
            ...process.env,
            GITHUB_REPOSITORY: "elmeragroup/fuse",
            GITHUB_SHA: "a".repeat(40),
            GITHUB_OUTPUT: output,
            TEST_GH_ARGS: args,
            TEST_MAIN_SHA: main.repeat(40),
            TEST_GH_STATUS: String(status),
          },
        }
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(status);
      expect(readFileSync(args, "utf8").trim()).toBe(
        "api repos/elmeragroup/fuse/git/ref/heads/main --jq .object.sha"
      );
      const outputs = existsSync(output) ? readFileSync(output, "utf8").split("\n") : [];
      expect(outputs.includes("current=true")).toBe(current);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
