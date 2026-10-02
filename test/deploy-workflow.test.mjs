import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { asRecord, asString } from "./json-object.mjs";
import { jobSteps, readWorkflow, requiredUsesStep } from "./workflow.mjs";

// These are security contracts on the deploy identities. GitHub accepts any of the violations
// below without complaint, and no linter knows which job may hold which Azure identity, so the
// invariants live here.

const prodClientId = "vars.AZURE_CLIENT_ID_PROD";
const previewClientId = "vars.AZURE_CLIENT_ID_PREVIEW";
/** A same-repository PR; fork PRs get no OIDC token under `pull_request`. */
const sameRepo = "github.event.pull_request.head.repo.full_name == github.repository";

/** @param {Record<string, unknown>} workflow @param {string} name */
function job(workflow, name) {
  return asRecord(asRecord(workflow.jobs, "workflow jobs")[name], name);
}

/** @param {Record<string, unknown>} value */
function yamlText(value) {
  return JSON.stringify(value);
}

describe("production deploy", () => {
  const merge = readWorkflow("merge");
  const deploy = job(merge, "deploy-prod");

  it("ships only a push to main that passed both merge gates", () => {
    expect(deploy.needs).toEqual(["checks", "browser"]);
    expect(asString(deploy.if, "deploy-prod condition")).toBe(
      `github.event_name == 'push' && github.ref == 'refs/heads/main' && ${prodClientId} != ''`
    );
  });

  it("requests an OIDC token and nothing that could write to the repository", () => {
    expect(deploy.permissions).toEqual({ contents: "read", "id-token": "write" });
  });

  it("never cancels a rollout in flight", () => {
    expect(deploy.concurrency).toEqual({ group: "deploy-prod", "cancel-in-progress": false });
  });

  it("uses the production subscription, registry and runtime identity", () => {
    const steps = jobSteps(merge, "deploy-prod");
    const login = requiredUsesStep(steps, "azure/login");
    expect(asRecord(login.with, "prod login")["subscription-id"]).toBe(
      "${{ vars.AZURE_SUBSCRIPTION_ID_PROD }}"
    );
    const image = steps.find((step) => step.uses === "./.github/actions/push-docs-image");
    expect(asRecord(image?.with, "prod image").registry).toBe("${{ vars.AZURE_ACR_NAME_PROD }}");
    const deployStep = steps.find((step) => step.run === "bash .github/scripts/docs-container-app.sh prod");
    const env = asRecord(deployStep?.env, "prod app configuration");
    expect(env.RESOURCE_GROUP).toBe("${{ vars.AZURE_RESOURCE_GROUP_PROD }}");
    expect(env.ENVIRONMENT).toBe("${{ vars.AZURE_CONTAINER_APPS_ENVIRONMENT_PROD }}");
    expect(env.MANAGED_IDENTITY_ID).toBe("${{ vars.AZURE_MANAGED_IDENTITY_ID_PROD }}");
    expect(env.SUFFIX).toBe("${{ format('r-{0}-{1}', github.run_id, github.run_attempt) }}");
    expect(yamlText(deploy)).not.toContain("_PREVIEW");
  });

  it("is the only merge job that names the production identity", () => {
    const jobs = asRecord(merge.jobs, "merge jobs");
    const holders = Object.keys(jobs).filter((name) =>
      yamlText(asRecord(jobs[name], name)).includes(prodClientId)
    );
    expect(holders).toEqual(["deploy-prod"]);
  });
});

describe("PR preview", () => {
  const preview = readWorkflow("preview");
  const source = readFileSync(new URL("../.github/workflows/preview.yml", import.meta.url), "utf8");

  it("runs on pull_request only, including close for teardown", () => {
    // `pull_request_target` would run with repository credentials for fork code.
    expect(asRecord(preview.on, "preview events")).toEqual({
      pull_request: { types: ["opened", "synchronize", "reopened", "closed"] },
    });
  });

  it("starts from no token permissions", () => {
    expect(preview.permissions).toEqual({});
  });

  it("never names the production identity", () => {
    // Checked on the raw file so comments and env blocks cannot smuggle it in either.
    expect(source).not.toContain("_PROD");
    expect(source).not.toContain("PROD_CONTAINER_APP");
  });

  it("deploys and tears down only same-repository PRs with the preview identity", () => {
    for (const name of ["deploy", "teardown"]) {
      const previewJob = job(preview, name);
      expect(asString(previewJob.if, `${name} condition`)).toContain(sameRepo);
      expect(asRecord(previewJob.permissions, `${name} permissions`)["id-token"]).toBe("write");
      const login = requiredUsesStep(jobSteps(preview, name), "azure/login");
      const withProps = asRecord(login.with, `${name} login`);
      expect(withProps["client-id"]).toBe(`\${{ ${previewClientId} }}`);
      expect(withProps["subscription-id"]).toBe("${{ vars.AZURE_SUBSCRIPTION_ID_PREVIEW }}");
    }
    expect(asString(job(preview, "deploy").if, "deploy condition")).toContain(
      "github.event.action != 'closed'"
    );
    expect(asString(job(preview, "teardown").if, "teardown condition")).toContain(
      "github.event.action == 'closed'"
    );
  });

  it("uses the test registry, environment and runtime identity", () => {
    expect(asRecord(preview.env, "preview environment").RESOURCE_GROUP).toBe(
      "${{ vars.AZURE_RESOURCE_GROUP_PREVIEW }}"
    );
    const steps = jobSteps(preview, "deploy");
    const image = steps.find((step) => step.uses === "./.github/actions/push-docs-image");
    expect(asRecord(image?.with, "preview image").registry).toBe("${{ vars.AZURE_ACR_NAME_PREVIEW }}");
    const deployStep = steps.find(
      (step) => step.run === "bash .github/scripts/docs-container-app.sh preview"
    );
    const env = asRecord(deployStep?.env, "preview app configuration");
    expect(env.ENVIRONMENT).toBe("${{ vars.AZURE_CONTAINER_APPS_ENVIRONMENT_PREVIEW }}");
    expect(env.MANAGED_IDENTITY_ID).toBe("${{ vars.AZURE_MANAGED_IDENTITY_ID_PREVIEW }}");
    expect(env.SUFFIX).toBe(
      "${{ format('pr-{0}-{1}-{2}', github.event.pull_request.number, github.run_id, github.run_attempt) }}"
    );
    const teardown = jobSteps(preview, "teardown");
    requiredUsesStep(teardown, "actions/checkout");
    expect(teardown.some((step) => step.run === "bash .github/scripts/docs-container-app.sh teardown")).toBe(
      true
    );
  });

  it("skips the deploy when the opt-out job finds the no-preview label", () => {
    const deploy = job(preview, "deploy");
    expect(deploy.needs).toBe("preview-opt-out");
    expect(asString(deploy.if, "deploy condition")).toContain("needs.preview-opt-out.outputs.skip != 'true'");
    const optOut = job(preview, "preview-opt-out");
    // The opt-out job runs exactly when the deploy would, so a skipped lookup never skips a deploy.
    expect(asString(deploy.if, "deploy condition")).toContain(asString(optOut.if, "opt-out condition"));
    expect(optOut.permissions).toEqual({ "pull-requests": "read" });
    expect(optOut.outputs).toEqual({ skip: "${{ steps.labels.outputs.skip }}" });
    expect(yamlText(optOut)).not.toContain("azure/login");
  });

  it.each([
    { name: "skips a PR labelled no-preview", labels: ["no-changeset", "no-preview"], skip: "true" },
    { name: "deploys a PR with other labels", labels: ["no-changeset", "no-canary"], skip: "false" },
    { name: "deploys a PR with no labels", labels: [], skip: "false" },
  ])("$name", ({ labels, skip }) => {
    const result = runOptOut(JSON.stringify({ number: 7, labels: labels.map((name) => ({ name })) }), 0);
    expect(result.status, result.stderr).toBe(0);
    expect(result.args).toMatch(/^api repos\/elmeragroup\/fuse\/pulls\/7 --jq /);
    expect(result.outputs).toEqual([`skip=${skip}`]);
  });

  it("fails the opt-out job, and so skips the deploy, when GitHub cannot return the PR", () => {
    const result = runOptOut("{}", 1);
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
    const step = jobSteps(preview, "preview-opt-out").find((candidate) => candidate.id === "labels");
    if (step === undefined) throw new Error("preview-opt-out job does not read the PR labels");
    expect(step.env).toEqual({ GH_TOKEN: "${{ github.token }}" });
    const scratch = mkdtempSync(join(tmpdir(), "elmera-preview-workflow-"));
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
            GITHUB_OUTPUT: output,
            // The workflow-level env the step reads.
            PR: "7",
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

  it("gives fork PRs no Azure identity", () => {
    const fork = job(preview, "fork");
    expect(fork.permissions).toBeUndefined();
    expect(yamlText(fork)).not.toContain("azure/login");
  });
});

describe("docs image", () => {
  const action = asRecord(
    parse(readFileSync(new URL("../.github/actions/push-docs-image/action.yml", import.meta.url), "utf8")),
    "push-docs-image"
  );

  it("builds linux/amd64 and tags by commit SHA, never latest", () => {
    const text = yamlText(action);
    expect(text).toContain('"platforms":"linux/amd64"');
    expect(text).toContain("fuse-docs:${SHA}");
    expect(text).not.toContain(":latest");
  });
});
