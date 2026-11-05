import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import picomatch from "picomatch";
import { describe, expect, it } from "vitest";

import { USAGE } from "../scripts/release.ts";
import { asRecord, asString, isPlainObject, isString, readJsonObject } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";
import {
  jobSteps,
  readWorkflow,
  requiredRunStep,
  requiredUsesStep,
  turboTasks,
  workflowNames,
} from "./workflow.mjs";

function rootScripts() {
  return asRecord(readJsonObject(join(repoRoot, "package.json")).scripts, "scripts");
}

/**
 * Every place a parsed workflow touches secrets, as `path: value`: each string that mentions the
 * `secrets` context, and each `secrets:` declaration, written as its keys or, for a reusable
 * workflow call, as `inherit`. A step in a list is named by its `id`, so the path survives renames
 * and reordering; a step without one is named by its position.
 * @param {unknown} value
 * @param {string} path
 * @returns {string[]}
 */
function secretReferences(value, path) {
  if (isString(value)) return /\bsecrets\b/.test(value) ? [`${path}: ${value}`] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const id = isPlainObject(item) && isString(item.id) ? item.id : `#${String(index)}`;
      return secretReferences(item, `${path}[${id}]`);
    });
  }
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const at = path === "" ? key : `${path}.${key}`;
    if (key !== "secrets") return secretReferences(item, at);
    const declared = isPlainObject(item) ? `{${Object.keys(item).sort().join(", ")}}` : String(item);
    return [`${at}: ${declared}`, ...secretReferences(item, at)];
  });
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
    expect(typeCheck[0], "script checking must run tsrs").toBe("tsrs");
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
      join(repoRoot, "node_modules/.bin/tsrs"),
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
    // npm signs provenance for GITHUB_SHA, but a retry dispatch runs at main's head while it
    // uploads an archive recorded for an earlier commit. Only the retry turns provenance off.
    const lines = command.split("\n").map((line) => line.trim());
    expect(lines.filter((line) => line.includes("NPM_CONFIG_PROVENANCE"))).toEqual([
      'NPM_CONFIG_PROVENANCE=false pnpm release retry "$RECORD_TAG"',
    ]);
    expect(lines).toContain('pnpm release publish "$SOURCE_COMMIT"');
    // The engine's GitHub authentication and its command inputs are env-driven; a dropped or
    // renamed expression would stay invisible until a real publication. npm authenticates through
    // the job's OIDC token, so the step holds no npm token.
    expect(asRecord(engine.env, "publish env")).toEqual({
      GH_TOKEN: "${{ github.token }}",
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

  it("installs an exact npm that can promote over OIDC before the engine runs, on both paths", () => {
    const steps = jobSteps(readWorkflow("publish-release"), "publish");
    const pin = requiredRunStep(steps, "npm install --global npm@");
    // The publish and retry paths both promote with `npm dist-tag add`, so the pin is unconditional.
    expect(pin.if).toBeUndefined();
    const version = /^npm install --global npm@(\d+)\.(\d+)\.(\d+)$/.exec(
      asString(pin.run, "npm pin").trim()
    );
    if (version === null) throw new Error("the npm pin must name an exact version");
    // npm documents 11.21.0 as the first release whose `dist-tag` authenticates over OIDC
    // (npm/cli#10038); the runner's bundled npm is older.
    const [major, minor] = version.slice(1).map(Number);
    expect(
      major > 11 || (major === 11 && minor >= 21),
      `npm ${version.slice(1).join(".")} must be at least 11.21.0`
    ).toBe(true);
    const engine = steps.findIndex(
      (step) => step.run !== undefined && asString(step.run, "publish run").includes("pnpm release ")
    );
    expect(steps.indexOf(pin)).toBeLessThan(engine);
  });

  it("publishes from the npm environment that npm's trusted-publisher entries name", () => {
    // An OIDC token from any other job, such as deploy-prod or a preview job, lacks the `npm`
    // environment claim and cannot match the entries.
    const job = asRecord(
      asRecord(readWorkflow("publish-release").jobs, "publish jobs").publish,
      "publish job"
    );
    expect(job.environment).toBe("npm");
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
    // npm authenticates over OIDC, so the caller passes no npm token, only the optional Slack token.
    expect(call.secrets).toEqual({ SLACK_BOT_TOKEN: { required: false } });
    const dispatch = asRecord(events.workflow_dispatch, "workflow_dispatch");
    const dispatchInputs = asRecord(dispatch.inputs, "dispatch inputs");
    expect(asRecord(dispatchInputs.record_tag, "record_tag").required).toBe(true);
  });

  it("grants the publish job the permissions the release path needs and nothing to other jobs", () => {
    // A dropped grant would stay invisible until the next real publication; the caller cannot
    // elevate the called workflow above these. `id-token: write` lets npm exchange the job's OIDC
    // token for a publish token. The workflow grants nothing, so a job without its own grant gets
    // no token rights rather than the publish job's.
    const workflow = readWorkflow("publish-release");
    expect(workflow.permissions).toEqual({});
    const publish = asRecord(asRecord(workflow.jobs, "publish jobs").publish, "publish job");
    expect(publish.permissions).toEqual({
      contents: "write",
      "pull-requests": "read",
      "id-token": "write",
    });
  });

  // The announcement only runs after a real publication, so a broken wire here would stay
  // invisible until a release went unannounced, was announced twice, or the Slack token reached
  // a job or step it was not meant for.
  describe("Slack announcement", () => {
    const workflow = readWorkflow("publish-release");
    const jobs = asRecord(workflow.jobs, "publish jobs");
    const notify = asRecord(jobs.notify, "notify job");
    const publishSteps = jobSteps(workflow, "publish");
    const notifySteps = jobSteps(workflow, "notify");
    /**
     * @param {Record<string, unknown>[]} steps
     * @param {string} id
     */
    const step = (steps, id) => {
      const found = steps.find((candidate) => candidate.id === id);
      if (found === undefined) throw new Error(`no ${id} step`);
      return found;
    };
    /** @param {Record<string, unknown>[]} steps */
    const runs = (steps) =>
      steps.flatMap((candidate) => (candidate.run === undefined ? [] : [asString(candidate.run, "run")]));

    it("finds the published release in the publish job, after the engine and under its lock", () => {
      const lookup = step(publishSteps, "release");
      expect(lookup.run).toBe("node tooling/release-announcement/src/find-release.ts");
      // A failed lookup must not fail a finished publication.
      expect(lookup["continue-on-error"]).toBe(true);
      expect(lookup.if).toBeUndefined();
      expect(asRecord(lookup.env, "lookup env")).toEqual({
        GH_TOKEN: "${{ github.token }}",
        SOURCE_COMMIT: "${{ inputs.source_commit }}",
        RECORD_TAG: "${{ inputs.record_tag }}",
      });
      const engine = publishSteps.findIndex(
        (candidate) =>
          candidate.run !== undefined && asString(candidate.run, "publish run").includes("pnpm release ")
      );
      const install = publishSteps.findIndex(
        (candidate) => candidate.run === "pnpm install --frozen-lockfile"
      );
      expect(engine).toBeGreaterThan(-1);
      expect(publishSteps.indexOf(lookup)).toBeGreaterThan(engine);
      // The lookup runs the announcement package, which the job's full install provides.
      expect(install).toBeGreaterThan(-1);
      expect(asRecord(asRecord(jobs.publish, "publish job").outputs, "publish outputs")).toEqual({
        "release-tag": "${{ steps.release.outputs.tag }}",
        release: "${{ steps.release.outputs.release }}",
      });
    });

    it("announces from one read-only job that installs only the announcement's runtime packages", () => {
      expect(Object.keys(jobs).sort()).toEqual(["notify", "publish"]);
      expect(notify.needs).toBe("publish");
      // A run that published nothing, or whose lookup failed, leaves the tag empty.
      expect(notify.if).toBe("needs.publish.outputs.release-tag != ''");
      expect(notify.permissions).toEqual({ contents: "read" });
      expect(notify.environment).toBeUndefined();
      expect(JSON.stringify(notify)).not.toContain("github.token");
      // The exact install: the frozen lockfile, no install scripts, and only the production
      // dependencies of the announcement package, so the token's job runs nothing else installed.
      expect(runs(notifySteps)).toEqual([
        "pnpm install --frozen-lockfile --ignore-scripts --prod --filter @elmeragroup/release-announcement",
        "node tooling/release-announcement/src/announce-release.ts",
      ]);
      expect(
        notifySteps.flatMap((candidate) =>
          candidate.uses === undefined ? [] : [asString(candidate.uses, "uses").split("@")[0]]
        )
      ).toEqual(["actions/checkout", "pnpm/action-setup", "actions/setup-node"]);
      const checkout = requiredUsesStep(notifySteps, "actions/checkout");
      // The full history holds a retried record's commit.
      expect(asRecord(checkout.with, "checkout inputs")).toEqual({
        "fetch-depth": 0,
        "persist-credentials": false,
      });
      const announce = step(notifySteps, "announce");
      expect(announce.run).toBe("node tooling/release-announcement/src/announce-release.ts");
      // A failed announcement fails the job, so a release is never silently left unannounced.
      expect(announce["continue-on-error"]).toBeUndefined();
      expect(asRecord(announce.env, "announce env")).toEqual({
        RELEASE: "${{ needs.publish.outputs.release }}",
        SLACK_RELEASES_CHANNEL: "${{ vars.SLACK_RELEASES_CHANNEL }}",
        SLACK_CANARY_CHANNEL: "${{ vars.SLACK_CANARY_CHANNEL }}",
        SLACK_BOT_TOKEN: "${{ secrets.SLACK_BOT_TOKEN }}",
      });
      // Slack is the receipt, so no Actions cache stands in for one.
      expect(notifySteps.filter((candidate) => String(candidate.uses).startsWith("actions/cache"))).toEqual(
        []
      );
    });

    it("reads the Slack token only in the fields allowed to, across every workflow", () => {
      // Each permitted reference, by workflow, job, step id and field. Display names, step order
      // and other steps are free to change; a new reference anywhere fails here.
      const allowed = [
        // The one secret merge.yml passes to the called workflow, by name; never `inherit`.
        "merge.yml jobs.release.secrets: {SLACK_BOT_TOKEN}",
        "merge.yml jobs.release.secrets.SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}",
        "publish-release.yml on.workflow_call.secrets: {SLACK_BOT_TOKEN}",
        // Only the step that announces holds the token; the install before it does not.
        "publish-release.yml jobs.notify.steps[announce].env.SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}",
      ];
      const found = workflowNames().flatMap((name) =>
        secretReferences(readWorkflow(name), "").map((reference) => `${name}.yml ${reference}`)
      );
      expect(found.sort()).toEqual([...allowed].sort());
    });

    it("announces one release at a time, queueing rather than dropping", () => {
      expect(notify.concurrency).toEqual({
        // An empty tag falls back to the run's own ID, so unrelated runs never share a group.
        group: "slack-announcement-${{ needs.publish.outputs.release-tag || github.run_id }}",
        "cancel-in-progress": false,
        queue: "max",
      });
    });
  });
});
