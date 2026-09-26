import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import picomatch from "picomatch";
import { describe, expect, it } from "vitest";

import { PUBLISH_GATES } from "../packages/fuse/scripts/release-pack.ts";
import { USAGE } from "../scripts/release.ts";
import { asRecord, asString, readJsonObject } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";
import { jobSteps, readWorkflow, requiredRunStep, requiredUsesStep, turboTasks } from "./workflow.mjs";

function rootScripts() {
  return asRecord(readJsonObject(join(repoRoot, "package.json")).scripts, "scripts");
}

describe("release wiring", () => {
  it("plans changesets against the remote-tracking base the release engine requires", () => {
    const config = readJsonObject(join(repoRoot, ".changeset/config.json"));
    expect(asString(config.baseBranch, "baseBranch")).toBe("origin/main");
  });

  it("pins the root release scripts to their entry points without freezing launcher flags", () => {
    const scripts = rootScripts();
    // Versioning must refresh the lockfile so the release PR carries a planned install.
    expect(asString(scripts["release:version"], "scripts.release:version")).toBe(
      "pnpm exec changeset version && pnpm install --lockfile-only"
    );
    const entryPoint = "scripts/release.ts";
    expect(existsSync(join(repoRoot, entryPoint)), "release must have a committed entry point").toBe(true);
    const tokens = asString(scripts.release, "scripts.release").split(/\s+/);
    expect(tokens[0], "release must launch node").toBe("node");
    expect(tokens.at(-1), "release must run its committed entry point").toBe(entryPoint);
    // The release CLI preloads the package loader so extension-less imports under
    // packages/fuse/scripts resolve; dropping it would only fail on the bot branch in CI.
    const loader = tokens.indexOf("--import");
    expect(loader, "release must preload the package loader").toBeGreaterThan(0);
    expect(tokens[loader + 1]).toBe("./packages/fuse/scripts/ts-resolve.mjs");
    const typeCheck = asString(scripts["type-check:scripts"], "scripts.type-check:scripts").split(/\s+/);
    expect(typeCheck[0], "script checking must run tsc").toBe("tsc");
    expect(typeCheck, "script checking must not emit").toContain("--noEmit");
    expect(typeCheck[typeCheck.indexOf("-p") + 1], "script checking must use the scripts config").toBe(
      "scripts/tsconfig.json"
    );
  });

  it("keeps the scripts program inside its cached task's inputs and the repo-policy task uncached", () => {
    // Evaluate the program against Turbo's own resolved inputs instead of a hand-copied allowlist:
    // a source glob that disappeared, or a new `!` exclusion, must fail here rather than stay green.
    // The repo-policy suite also runs this program, but its walkers read files across the workspace,
    // so a complete input list is not practical and it is deliberately uncached (turbo.json) and
    // has no cache key to verify — pin that instead of a list that would only look meaningful.
    const tasks = turboTasks(["run", "type-check:scripts", "test:repo-policy"]);
    const repoTests = tasks.find((candidate) => candidate.taskId === "//#test:repo-policy");
    if (repoTests === undefined) throw new Error("turbo has no //#test:repo-policy task");
    expect(
      asRecord(repoTests.resolvedTaskDefinition, "resolved task definition").cache,
      "//#test:repo-policy must stay uncached"
    ).toBe(false);

    const taskId = "//#type-check:scripts";
    const task = tasks.find((candidate) => candidate.taskId === taskId);
    if (task === undefined) throw new Error(`turbo has no ${taskId} task`);
    const inputs = asRecord(task.resolvedTaskDefinition, "resolved task definition").inputs;
    if (!Array.isArray(inputs)) throw new Error(`${taskId} inputs is not an array`);
    const patterns = inputs.map((input) => asString(input, `${taskId} input`));
    const positive = patterns
      .filter((pattern) => !pattern.startsWith("!"))
      .map((pattern) => picomatch(pattern, { dot: true }));
    const negative = patterns
      .filter((pattern) => pattern.startsWith("!"))
      .map((pattern) => picomatch(pattern.slice(1), { dot: true }));

    // The program's import closure must stay inside those inputs; a new packages/fuse/src import in
    // an adapter file would move a gate input outside the cache key.
    const listed = execFileSync(
      join(repoRoot, "node_modules/.bin/tsc"),
      ["--noEmit", "--listFiles", "-p", "scripts/tsconfig.json"],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 60_000 }
    );
    const programFiles = listed
      .split("\n")
      .filter((line) => line !== "" && !line.includes("/node_modules/"))
      .map((line) => relative(repoRoot, line));
    expect(programFiles.length, "the scripts program must list its source files").toBeGreaterThan(0);
    for (const file of programFiles) {
      expect(
        positive.some((matcher) => matcher(file)),
        `${file} is outside the turbo inputs of ${taskId}`
      ).toBe(true);
      expect(
        negative.some((matcher) => matcher(file)),
        `${file} is excluded from the turbo inputs of ${taskId}`
      ).toBe(false);
    }
  }, 60_000);

  it("loads the release CLI to its usage error without publishing", () => {
    const tokens = asString(rootScripts().release, "scripts.release").split(/\s+/);
    const probe = spawnSync(tokens[0], tokens.slice(1), {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(probe.error, "release entry point probe should not time out or fail to spawn").toBeUndefined();
    expect(probe.status, probe.stderr).not.toBe(0);
    expect(probe.stderr).toContain(USAGE);
  }, 30_000);

  it("schedules every publish gate through the ci:checks aggregate", () => {
    // The merge `checks` job runs explicit task names and `test:packed-consumer` runs in the
    // `browser` job; this pins the aggregate a local `pnpm ci:checks` fans out.
    expect([...PUBLISH_GATES]).toEqual(["package:check", "size-limit", "test:packed-consumer"]);
    const tasks = turboTasks(["run", "ci:checks"]);
    const fuseChecks = asRecord(
      tasks.find((task) => task.taskId === "@elmeragroup/fuse#ci:checks"),
      "@elmeragroup/fuse#ci:checks"
    );
    const dependencies = fuseChecks.dependencies;
    if (!Array.isArray(dependencies)) throw new Error("ci:checks dependencies is not an array");
    for (const gate of PUBLISH_GATES) {
      expect(dependencies, `${gate} must also run in the ci:checks aggregate`).toContain(
        `@elmeragroup/fuse#${gate}`
      );
    }
  }, 30_000);

  it("invokes the release engine from the publish workflow after installing Chromium", () => {
    // The publish job carries its own `if`, so read its steps through jobSteps rather than
    // through requiredJobSteps, which asserts an unconditional job.
    const steps = jobSteps(readWorkflow("publish-release"), "publish");
    const engineSteps = steps.filter(
      (step) => step.run !== undefined && asString(step.run, "publish run").includes("pnpm release ")
    );
    expect(engineSteps).toHaveLength(1);
    const engine = engineSteps[0];
    const command = asString(engine.run, "publish run");
    expect(command).toContain('pnpm release retry "$RECORD_TAG"');
    expect(command).toContain('pnpm release publish "$SOURCE_COMMIT"');
    // The engine's GitHub and npm authentication and its command inputs are env-driven; a dropped
    // or renamed expression would stay invisible until a real publication.
    expect(asRecord(engine.env, "publish env")).toEqual({
      GH_TOKEN: "${{ github.token }}",
      NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
      SOURCE_COMMIT: "${{ inputs.source_commit }}",
      RECORD_TAG: "${{ inputs.record_tag }}",
    });
    // The engine publishes the checked commit or restores the recorded one, so the checkout must
    // fetch full history for that commit without leaving credentialed state for later steps.
    const checkout = requiredUsesStep(steps, "actions/checkout");
    expect(asRecord(checkout.with, "checkout inputs")).toEqual({
      ref: "${{ inputs.source_commit || github.sha }}",
      "fetch-depth": 0,
      "persist-credentials": false,
    });
    // test:packed-consumer launches Playwright Chromium on this fresh runner, so the browser
    // install must precede the engine run.
    const browser = requiredRunStep(steps, "pnpm --filter @elmeragroup/fuse exec playwright install");
    expect(browser.if).toBe("inputs.record_tag == ''");
    expect(browser.run).toBe("pnpm --filter @elmeragroup/fuse exec playwright install --with-deps chromium");
    expect(steps.indexOf(browser)).toBeLessThan(steps.indexOf(engine));
  });

  it("keeps a bounded queue for publications instead of replacing a waiting release", () => {
    const workflow = readWorkflow("publish-release");
    const job = asRecord(asRecord(workflow.jobs, "publish jobs").publish, "publish job");
    expect(asString(job.if, "publish condition")).toBe("github.ref == 'refs/heads/main'");
    const concurrency = asRecord(job.concurrency, "publish concurrency");
    expect(asString(concurrency.group, "concurrency group")).toBe("npm-release");
    expect(concurrency["cancel-in-progress"]).toBe(false);
    // GitHub replaces the single waiting job by default; a waiting stable merge could be
    // dropped before it records its publication.
    expect(asString(concurrency.queue, "concurrency queue")).toBe("max");
  });

  it("publish workflow takes a checked commit on call and a record tag on dispatch", () => {
    const workflow = readWorkflow("publish-release");
    const events = asRecord(workflow.on, "publish events");
    const call = asRecord(events.workflow_call, "workflow_call");
    const callInputs = asRecord(call.inputs, "workflow_call inputs");
    expect(asRecord(callInputs.source_commit, "source_commit").required).toBe(true);
    // A caller cannot request a retry; that path stays dispatch-only.
    expect(callInputs.record_tag).toBeUndefined();
    const dispatch = asRecord(events.workflow_dispatch, "workflow_dispatch");
    const dispatchInputs = asRecord(dispatch.inputs, "dispatch inputs");
    expect(asRecord(dispatchInputs.record_tag, "record_tag").required).toBe(true);
  });

  it("grants the publish workflow the permissions the release path needs", () => {
    // The workflow runs only after activation, so a dropped grant would stay invisible until
    // the first real publication; the caller cannot elevate the called workflow above these.
    expect(readWorkflow("publish-release").permissions).toEqual({
      contents: "write",
      "pull-requests": "read",
    });
  });
});
