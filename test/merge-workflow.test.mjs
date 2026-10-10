import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import {
  jobMatrixEntries,
  jobSteps,
  readWorkflow,
  requiredJobSteps,
  requiredRunStep,
  requiredUsesStep,
  resolveMatrixExpressions,
} from "./workflow.mjs";

/** Both release jobs run only for a push to main once publishing is activated. */
const activatedPush =
  "github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.RELEASE_ENABLED == 'true'";

describe("merge workflow", () => {
  const workflow = readWorkflow("merge");

  it.each([
    { job: "checks", leg: undefined },
    { job: "browser", leg: "packages" },
    { job: "browser", leg: "docs-1" },
    { job: "browser", leg: "docs-2" },
    { job: "browser", leg: "docs-3" },
    { job: "browser", leg: "docs-4" },
  ])(
    "$job $leg restores turbo's cache before its gate except on main, and prunes then saves it once the gate ran",
    ({ job, leg }) => {
      const entry = asRecord(
        jobMatrixEntries(workflow, job).find((candidate) => candidate.leg === leg),
        `${job} ${leg} matrix entry`
      );
      const prefix = leg === undefined ? `turbo-${job}-` : `turbo-${job}-${leg}-`;
      const steps = requiredJobSteps(workflow, job);
      const gate = requiredRunStep(steps, "pnpm exec turbo run ");
      // Pruning keeps only the hashes the run summaries record; without them it refuses to run.
      expect(asRecord(gate.env, `${job} gate env`).TURBO_RUN_SUMMARY).toBe("true");

      // `github.job` is null in job-level env, so the key spells out the job id. Cache keys are
      // immutable, so every attempt saves under its own key and restores by prefix. Browser
      // legs must use separate prefixes so their independent task sets restore their own entries.
      const jobEnv = asRecord(asRecord(asRecord(workflow.jobs, "merge jobs")[job], job).env, `${job} env`);
      expect(resolveMatrixExpressions(asString(jobEnv.TURBO_CACHE_KEY, `${job} cache key`), entry)).toBe(
        `${prefix}\${{ github.sha }}-\${{ github.run_id }}-\${{ github.run_attempt }}`
      );

      const restore = requiredUsesStep(steps, "actions/cache/restore");
      const restoreWith = asRecord(restore.with, `${job} restore with`);
      expect(restoreWith.path).toBe(".turbo/cache");
      expect(restoreWith.key).toBe("${{ env.TURBO_CACHE_KEY }}");
      expect(
        resolveMatrixExpressions(asString(restoreWith["restore-keys"], `${job} restore keys`), entry)
          .trim()
          .split("\n")
      ).toEqual([`${prefix}\${{ github.sha }}-`, prefix]);
      // Every run on main, pushed or dispatched, verifies cold, so under-declared task inputs
      // cannot replay a false green there.
      expect(restore.if).toBe("${{ github.ref != 'refs/heads/main' }}");

      // A red gate still prunes and saves; a gate that never started has nothing to keep.
      const prune = requiredRunStep(steps, "pnpm turbo-cache:prune");
      expect(prune.if).toBe(`\${{ always() && steps.${asString(gate.id, "gate id")}.outcome != 'skipped' }}`);

      const save = requiredUsesStep(steps, "actions/cache/save");
      const saveWith = asRecord(save.with, `${job} save with`);
      expect(saveWith.path).toBe(".turbo/cache");
      expect(saveWith.key).toBe("${{ env.TURBO_CACHE_KEY }}");
      expect(save.if).toBe(
        `\${{ always() && steps.${asString(prune.id, "prune id")}.outcome == 'success' }}`
      );

      const order = [restore, gate, prune, save].map((step) => steps.indexOf(step));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  );

  it("runs formatting and installs Chromium in their required jobs", () => {
    const checks = requiredJobSteps(workflow, "checks");
    const format = requiredRunStep(checks, "pnpm exec oxfmt");
    expect(format.if).toBeUndefined();
    expect(format.run).toBe("pnpm exec oxfmt --check");

    const browser = requiredJobSteps(workflow, "browser");
    const job = asRecord(asRecord(workflow.jobs, "merge jobs").browser, "browser job");
    expect(job.name).toBe("browser (${{ matrix.leg }})");
    expect(asRecord(job.strategy, "browser strategy")["fail-fast"]).toBe(false);
    // The version step's script does not start with its pnpm command, so find it by id.
    const version = browser.find((step) => step.id === "playwright");
    if (version === undefined) throw new Error("browser job does not resolve the Playwright version");
    expect(asString(version.run, "version run")).toContain(
      "pnpm --filter @elmeragroup/fuse exec playwright --version"
    );
    const cache = requiredUsesStep(browser, "actions/cache");
    expect(asRecord(cache.with, "playwright cache inputs")).toEqual({
      path: "~/.cache/ms-playwright",
      key: `playwright-chromium-\${{ runner.os }}-\${{ steps.${asString(version.id, "version id")}.outputs.version }}`,
    });
    const hit = `steps.${asString(cache.id, "cache id")}.outputs.cache-hit`;
    const install = requiredRunStep(
      browser,
      "pnpm --filter @elmeragroup/fuse exec playwright install --with-deps"
    );
    expect(install.run).toBe("pnpm --filter @elmeragroup/fuse exec playwright install --with-deps chromium");
    expect(install.if).toBe(`${hit} != 'true'`);
    const deps = requiredRunStep(browser, "pnpm --filter @elmeragroup/fuse exec playwright install-deps");
    expect(deps.run).toBe("pnpm --filter @elmeragroup/fuse exec playwright install-deps chromium");
    expect(deps.if).toBe(`${hit} == 'true'`);
    const gate = requiredRunStep(browser, "pnpm exec turbo run ");
    const order = [version, cache, install, gate].map((step) => browser.indexOf(step));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // A deps step above the cache reads an unset cache-hit and never runs on a hit.
    expect(browser.indexOf(cache)).toBeLessThan(browser.indexOf(deps));
    expect(browser.indexOf(deps)).toBeLessThan(browser.indexOf(gate));
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
    // The base ref reaches the shell through env, never through an inline expression.
    expect(step.env).toEqual({ BASE_REF: "${{ github.base_ref }}" });
    expect(step.run).toBe('pnpm exec changeset status --since="origin/$BASE_REF"');
    expect(asString(step.if, "changeset condition").replace(/\s+/g, " ").trim()).toBe(
      "${{ github.event_name == 'pull_request' && env.IS_SELF_RELEASE_PR != 'true' && !contains(github.event.pull_request.labels.*.name, 'no-changeset') }}"
    );
  });

  it("runs dependency code with a read-only token that the checkouts do not persist", () => {
    // Job-level grants replace this default, so release and version keep their own (asserted below).
    expect(workflow.permissions).toEqual({ contents: "read" });
    // Only checks reads history (changeset status --since), so only it clones deeply.
    const checkoutInputs = {
      checks: { "fetch-depth": 0, "persist-credentials": false },
      browser: { "persist-credentials": false },
    };
    for (const [job, inputs] of Object.entries(checkoutInputs)) {
      const checkout = requiredUsesStep(requiredJobSteps(workflow, job), "actions/checkout");
      expect(asRecord(checkout.with, `${job} checkout inputs`)).toEqual(inputs);
      const definition = asRecord(asRecord(workflow.jobs, "merge jobs")[job], job);
      expect(definition["timeout-minutes"], `${job} timeout`).toBe(45);
    }
  });

  it("publishes and prepares the version PR only from an activated push to main", () => {
    const jobs = asRecord(workflow.jobs, "merge jobs");
    const release = asRecord(jobs.release, "release job");
    expect(release.needs).toEqual(["checks", "browser", "canary-opt-out"]);
    expect(release.if).toBe(`${activatedPush} && needs.canary-opt-out.outputs.skip != 'true'`);
    const optOut = asRecord(jobs["canary-opt-out"], "canary-opt-out job");
    expect(optOut.if).toBe(activatedPush);
    expect(optOut.permissions).toEqual({ "pull-requests": "read" });
    expect(optOut.outputs).toEqual({ skip: "${{ steps.labels.outputs.skip }}" });
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
    expect(version.needs).toEqual(["checks", "browser"]);
    expect(version.if).toBe(activatedPush);
    expect(version.uses).toBe("./.github/workflows/version-packages.yml");
    // The version job writes the bot PR and dispatches merge.yml for its checks.
    expect(version.permissions).toEqual({
      contents: "write",
      "pull-requests": "write",
      actions: "write",
    });
  });

  // The commit-pulls API lists every PR containing the commit; only the one merged as it counts.
  const sha = "a".repeat(40);
  /**
   * A PR merged as `sha`, shaped like the commit-pulls API response.
   * @param {string[]} labels
   * @param {string} [head]
   */
  const merged = (labels, head = "feature") => ({
    merge_commit_sha: sha,
    head: { ref: head },
    labels: labels.map((name) => ({ name })),
  });
  it.each([
    {
      name: "skips a canary for a merged PR labelled no-canary",
      pulls: [merged(["no-changeset", "no-canary"])],
      skip: "true",
    },
    { name: "publishes for a merged PR without the label", pulls: [merged(["no-changeset"])], skip: "false" },
    { name: "publishes for a direct push with no PR", pulls: [], skip: "false" },
    {
      name: "ignores the label on an open PR that also contains the commit",
      pulls: [merged([]), { ...merged(["no-canary"]), merge_commit_sha: "b".repeat(40) }],
      skip: "false",
    },
    {
      name: "never skips the stable release PR's merge",
      pulls: [merged(["no-canary"], "changeset-release/main")],
      skip: "false",
    },
  ])("$name", ({ pulls, skip }) => {
    const result = runOptOut(JSON.stringify(pulls), 0);
    expect(result.status, result.stderr).toBe(0);
    expect(result.args).toMatch(/^api repos\/elmeragroup\/fuse\/commits\/a{40}\/pulls --jq /);
    expect(result.outputs).toEqual([`skip=${skip}`]);
  });

  it("fails the opt-out job, and so skips publication, when GitHub cannot list the PRs", () => {
    const result = runOptOut("[]", 1);
    expect(result.status).toBe(1);
    expect(result.outputs).toEqual([]);
  });

  /**
   * Executes the opt-out job's actual shell step with only GitHub's transport replaced: the fake
   * `gh` applies the step's `--jq` filter to the given API response, as `gh api --jq` does.
   * @param {string} response
   * @param {number} status
   */
  function runOptOut(response, status) {
    const step = jobSteps(workflow, "canary-opt-out").find((candidate) => candidate.id === "labels");
    if (step === undefined) throw new Error("canary-opt-out job does not read the PR labels");
    expect(step.env).toEqual({ GH_TOKEN: "${{ github.token }}" });
    const scratch = mkdtempSync(join(tmpdir(), "elmera-merge-workflow-"));
    const output = join(scratch, "output");
    const args = join(scratch, "gh-args");
    try {
      const result = spawnSync(
        "bash",
        [
          "-e",
          "-c",
          `gh() {
            printf '%s\\n' "$*" > "$TEST_GH_ARGS"
            [ "$TEST_GH_STATUS" = 0 ] || return "$TEST_GH_STATUS"
            printf '%s' "$TEST_RESPONSE" | jq -r "\${@: -1}"
          }
          ${asString(step.run, "opt-out run")}`,
        ],
        {
          encoding: "utf8",
          timeout: 5_000,
          env: {
            ...process.env,
            GITHUB_REPOSITORY: "elmeragroup/fuse",
            GITHUB_SHA: sha,
            GITHUB_OUTPUT: output,
            TEST_GH_ARGS: args,
            TEST_RESPONSE: response,
            TEST_GH_STATUS: String(status),
          },
        }
      );
      expect(result.error).toBeUndefined();
      return {
        status: result.status,
        stderr: result.stderr,
        args: readFileSync(args, "utf8").trim(),
        outputs: existsSync(output) ? readFileSync(output, "utf8").split("\n").filter(Boolean) : [],
      };
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
});
