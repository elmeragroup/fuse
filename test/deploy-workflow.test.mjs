import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { asRecord, asString } from "./json-object.mjs";
import { readWorkflow } from "./workflow.mjs";

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
    expect(source).not.toContain("AZURE_CLIENT_ID_PROD");
  });

  it("deploys and tears down only same-repository PRs with the preview identity", () => {
    for (const name of ["deploy", "teardown"]) {
      const previewJob = job(preview, name);
      expect(asString(previewJob.if, `${name} condition`)).toContain(sameRepo);
      expect(asRecord(previewJob.permissions, `${name} permissions`)["id-token"]).toBe("write");
      expect(yamlText(previewJob)).toContain(previewClientId);
    }
    expect(asString(job(preview, "deploy").if, "deploy condition")).toContain(
      "github.event.action != 'closed'"
    );
    expect(asString(job(preview, "teardown").if, "teardown condition")).toContain(
      "github.event.action == 'closed'"
    );
  });

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
