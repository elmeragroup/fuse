import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { asString } from "./json-object.mjs";
import { jobSteps, readWorkflow } from "./workflow.mjs";

describe("version workflow freshness check", () => {
  it.each([
    { name: "allows the current main commit", main: "a", status: 0, current: true },
    { name: "skips an older commit whose checks finish last", main: "b", status: 0, current: false },
    { name: "fails closed when GitHub cannot return main", main: "a", status: 1, current: false },
  ])("$name", ({ main, status, current }) => {
    const guard = jobSteps(readWorkflow("version-packages"), "version").find(
      (step) => step.id === "current-main"
    );
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
            GITHUB_REPOSITORY: "elmeragroup/ui",
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
        "api repos/elmeragroup/ui/git/ref/heads/main --jq .object.sha"
      );
      const outputs = existsSync(output) ? readFileSync(output, "utf8").split("\n") : [];
      expect(outputs.includes("current=true")).toBe(current);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
