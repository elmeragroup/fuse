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
  requiredCacheStep,
  requiredJobSteps,
  requiredRunStep,
  requiredUsesStep,
  resolveMatrixExpressions,
} from "./workflow.mjs";

/** Both release jobs run only for a push to main once publishing is activated. */
const activatedPush =
  "github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.RELEASE_ENABLED == 'true'";

/** Where the browser legs keep the cached system packages. */
const debs = "${{ runner.temp }}/playwright-debs";

/**
 * The browser job's two runs of the system-package installer, in order: the first and the
 * rescue. Both run the same command, matched whole so nothing appended (such as `|| true`) can
 * swallow a failure; the steps' conditions, not the script, tell the runs apart.
 * @param {Record<string, unknown>[]} steps
 */
function depsRuns(steps) {
  const runs = steps.filter(
    (step) =>
      step.run !== undefined &&
      asString(step.run, "step run").startsWith("bash .github/scripts/install-playwright-deps.sh")
  );
  expect(runs.map((step) => step.run)).toEqual([
    "bash .github/scripts/install-playwright-deps.sh",
    "bash .github/scripts/install-playwright-deps.sh",
  ]);
  const [first, rescue] = runs;
  return { first, rescue };
}

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

      const restore = requiredCacheStep(steps, "actions/cache/restore", ".turbo/cache");
      const restoreWith = asRecord(restore.with, `${job} restore with`);
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

      const save = requiredCacheStep(steps, "actions/cache/save", ".turbo/cache");
      const saveWith = asRecord(save.with, `${job} save with`);
      expect(saveWith.key).toBe("${{ env.TURBO_CACHE_KEY }}");
      expect(save.if).toBe(
        `\${{ always() && steps.${asString(prune.id, "prune id")}.outcome == 'success' }}`
      );

      const order = [restore, gate, prune, save].map((step) => steps.indexOf(step));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  );

  it("runs formatting and installs Chromium, Firefox and WebKit in their required jobs", () => {
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
    const cache = requiredCacheStep(browser, "actions/cache", "~/.cache/ms-playwright");
    expect(asRecord(cache.with, "playwright cache inputs").key).toBe(
      `playwright-chromium-firefox-webkit-\${{ runner.os }}-\${{ steps.${asString(version.id, "version id")}.outputs.version }}`
    );
    // Only a browser-cache miss downloads browsers, and it leaves their system packages to the
    // deps step, which every leg runs.
    const install = requiredRunStep(browser, "pnpm --filter @elmeragroup/fuse exec playwright install ");
    expect(install.run).toBe(
      "pnpm --filter @elmeragroup/fuse exec playwright install chromium firefox webkit"
    );
    expect(install.if).toBe(`steps.${asString(cache.id, "cache id")}.outputs.cache-hit != 'true'`);
    const { first } = depsRuns(browser);
    const gate = requiredRunStep(browser, "pnpm exec turbo run ");
    const order = [version, cache, install, first, gate].map((step) => browser.indexOf(step));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("caches the browsers' system packages per runner image and Playwright version", () => {
    const browser = requiredJobSteps(workflow, "browser");
    const job = asRecord(asRecord(workflow.jobs, "merge jobs").browser, "browser job");
    const version = browser.find((step) => step.id === "playwright");
    if (version === undefined) throw new Error("browser job does not resolve the Playwright version");
    const image = browser.find((step) => step.id === "runner-image");
    if (image === undefined) throw new Error("browser job does not resolve the runner image");
    const { first, rescue } = depsRuns(browser);
    const failed = `steps.${asString(first.id, "first deps id")}.outcome == 'failure'`;

    // The first restore runs on every leg; the rescue restores the same key again only after
    // the first run failed, when a sibling has usually saved it.
    const restores = browser.filter(
      (step) =>
        step.uses !== undefined &&
        asString(step.uses, "step uses").startsWith("actions/cache/restore@") &&
        asRecord(step.with, "restore inputs").path === debs
    );
    expect(restores).toHaveLength(2);
    const [restore, rescueRestore] = restores;
    // A cached set only installs onto the dpkg state it was resolved against, and only lists
    // the packages of the Playwright version that asked for them.
    expect(asRecord(restore.with, "deps restore inputs").key).toBe(
      `playwright-debs-\${{ steps.${asString(image.id, "image id")}.outputs.image }}-\${{ steps.${asString(version.id, "version id")}.outputs.version }}`
    );
    expect(restore.if).toBeUndefined();
    const restored = `steps.${asString(restore.id, "deps restore id")}.outputs`;
    expect(rescueRestore.if).toBe(failed);
    expect(asRecord(rescueRestore.with, "rescue restore inputs").key).toBe(
      `\${{ ${restored}.cache-primary-key }}`
    );

    // Every leg installs, so the first run has no condition; its failure leaves the leg to the
    // rescue instead of failing it. The rescue reads the second restore and fails the leg itself.
    expect(first.if).toBeUndefined();
    expect(first["continue-on-error"]).toBe(true);
    expect(first.env).toEqual({ CACHE_HIT: `\${{ ${restored}.cache-hit }}`, DEBS: debs });
    expect(rescue.if).toBe(failed);
    expect(rescue["continue-on-error"]).toBeUndefined();
    expect(rescue.env).toEqual({
      CACHE_HIT: `\${{ steps.${asString(rescueRestore.id, "rescue restore id")}.outputs.cache-hit }}`,
      DEBS: debs,
    });
    // Both bounded runs end well inside the job, so two stalls fail the leg instead of its budget.
    expect(Number(first["timeout-minutes"]) + Number(rescue["timeout-minutes"])).toBeLessThan(
      Number(job["timeout-minutes"])
    );

    // The script offers a set only after a download on a miss; either run's offer saves it.
    const save = requiredCacheStep(browser, "actions/cache/save", debs);
    expect(save.if).toBe(
      `steps.${asString(first.id, "first deps id")}.outputs.save == 'true' || steps.${asString(rescue.id, "rescue deps id")}.outputs.save == 'true'`
    );
    expect(asRecord(save.with, "deps save inputs").key).toBe(`\${{ ${restored}.cache-primary-key }}`);

    const browsers = requiredCacheStep(browser, "actions/cache", "~/.cache/ms-playwright");
    const gate = requiredRunStep(browser, "pnpm exec turbo run ");
    const order = [version, image, restore, first, rescueRestore, rescue, save, gate].map((step) =>
      browser.indexOf(step)
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(browser.indexOf(browsers)).toBeLessThan(browser.indexOf(first));
  });

  it.each([
    {
      name: "names the runner image from its environment",
      env: { ImageOS: "ubuntu26", ImageVersion: "20261101.1.0" },
      status: 0,
      outputs: ["image=ubuntu26-20261101.1.0"],
    },
    {
      name: "fails rather than key the cache without an image",
      env: { ImageOS: "ubuntu26" },
      status: 1,
      outputs: [],
    },
  ])("$name", ({ env, status, outputs }) => {
    const step = jobSteps(workflow, "browser").find((candidate) => candidate.id === "runner-image");
    if (step === undefined) throw new Error("browser job does not resolve the runner image");
    const scratch = mkdtempSync(join(tmpdir(), "elmera-merge-workflow-"));
    const output = join(scratch, "output");
    try {
      // Only the case's variables reach the step, so the runner's own image cannot leak in.
      const result = spawnSync("bash", ["-e", "-c", asString(step.run, "runner image run")], {
        encoding: "utf8",
        timeout: 5_000,
        env: { PATH: "/usr/bin:/bin", ...env, GITHUB_OUTPUT: output },
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(status);
      expect(existsSync(output) ? readFileSync(output, "utf8").split("\n").filter(Boolean) : []).toEqual(
        outputs
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
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
    // publication with `contents: write`, reads the release PR with `pull-requests: read`, and
    // npm authenticates with the job's OIDC token through `id-token: write`.
    expect(release.permissions).toEqual({
      contents: "write",
      "pull-requests": "read",
      "id-token": "write",
    });
    // The job is skipped while RELEASE_ENABLED is unset, so dropped call wiring would stay
    // invisible until activation.
    const releaseWith = asRecord(release.with, "release with");
    expect(releaseWith.source_commit).toBe("${{ github.sha }}");
    // npm authenticates over OIDC, so the call passes no secrets.
    expect(release.secrets).toBeUndefined();
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
