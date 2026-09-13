import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asRecord, asString, readJsonObject } from "./json-object.mjs";
import { jobSteps, readWorkflow, requiredJobSteps, requiredRunStep } from "./workflow.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("release wiring", () => {
  it("plans changesets against the remote-tracking base the release engine requires", () => {
    const config = readJsonObject(join(repoRoot, ".changeset/config.json"));
    expect(asString(config.baseBranch, "baseBranch")).toBe("origin/main");
  });

  it("validates the stable release PR in the merge checks", () => {
    const step = requiredRunStep(requiredJobSteps(readWorkflow("merge"), "checks"), "pnpm release:check-pr");
    expect(step.run).toBe("pnpm release:check-pr");
    expect(step.if).toBe(
      "(github.head_ref == 'changeset-release/main' && github.event.pull_request.head.repo.full_name == github.repository) || github.ref == 'refs/heads/changeset-release/main'"
    );
  });

  it("pins the engine entry points as exact root scripts", () => {
    const scripts = asRecord(readJsonObject(join(repoRoot, "package.json")).scripts, "scripts");
    expect(asString(scripts["release:version"], "scripts.release:version")).toBe(
      "pnpm exec changeset version && pnpm install --lockfile-only"
    );
    expect(asString(scripts["release:run"], "scripts.release:run")).toBe(
      "node --experimental-strip-types --experimental-transform-types scripts/publish-release.ts"
    );
    expect(asString(scripts["release:check-pr"], "scripts.release:check-pr")).toBe(
      "node --experimental-strip-types --experimental-transform-types scripts/check-release-pr.ts"
    );
    expect(asString(scripts["type-check:scripts"], "scripts.type-check:scripts")).toBe(
      "tsc --noEmit -p scripts/tsconfig.json"
    );
  });

  it("invokes the release engine from the publish workflow", () => {
    // The publish job carries its own `if`, so read its steps through jobSteps rather than
    // through requiredJobSteps, which asserts an unconditional job.
    const steps = jobSteps(readWorkflow("publish-release"), "publish");
    const engine = steps.find(
      (step) => step.run !== undefined && asString(step.run, "publish run").includes("pnpm release:run")
    );
    if (engine === undefined) throw new Error("publish job does not run the release engine");
    const command = asString(engine.run, "publish run");
    expect(command).toContain('pnpm release:run retry "$RECORD_TAG"');
    expect(command).toContain('pnpm release:run main "$SOURCE_COMMIT"');
  });

  it("publish workflow takes a checked commit on call and a record tag on dispatch", () => {
    const workflow = readWorkflow("publish-release");
    const events = asRecord(workflow.on, "publish events");
    const call = asRecord(events.workflow_call, "workflow_call");
    const callInputs = asRecord(call.inputs, "workflow_call inputs");
    expect(asRecord(callInputs.source_commit, "source_commit").required).toBe(true);
    const dispatch = asRecord(events.workflow_dispatch, "workflow_dispatch");
    const dispatchInputs = asRecord(dispatch.inputs, "dispatch inputs");
    expect(asRecord(dispatchInputs.record_tag, "record_tag").required).toBe(true);
  });

  it("version workflow versions through the root script and triggers the release PR checks", () => {
    const steps = requiredJobSteps(readWorkflow("version-packages"), "version");
    const action = steps.find((step) => step.uses === "changesets/action@v2");
    if (action === undefined) throw new Error("version job does not use changesets/action@v2");
    const withInput = asRecord(action.with, "changesets action inputs");
    expect(withInput["version-script"]).toBe("pnpm release:version");
    requiredRunStep(steps, "gh workflow run merge.yml");
  });
});
