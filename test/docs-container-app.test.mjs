import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";

// Unit under test: the deploy script's CLI. Oracle: the supplied infra configuration and
// Azure's revision/label lifecycle. Only Azure's transport is replaced; shell branches,
// filtering, failure handling and GitHub outputs execute unchanged.
const script = fileURLToPath(new URL("../.github/scripts/docs-container-app.sh", import.meta.url));

/**
 * @param {string} mode
 * @param {Record<string, { stdout?: string, stderr?: string, status?: number }[]>} replies
 */
function deploy(mode, replies = {}) {
  const directory = mkdtempSync(join(tmpdir(), "fuse-docs-deploy-"));
  const app = mode === "prod" ? "p-fuse-docs-ca" : "t-fuse-docs-ca";
  const output = join(directory, "output");
  const trace = join(directory, "trace");
  const responses = join(directory, "responses.json");
  const suffix = mode === "prod" ? "r-9001-1" : "pr-38-9001-1";
  writeFileSync(output, "");
  writeFileSync(trace, "");
  writeFileSync(
    responses,
    JSON.stringify({
      "containerapp list": [{ stdout: app }],
      "containerapp show properties.provisioningState": [{ stdout: "Succeeded" }],
      "containerapp show properties.configuration.ingress.fqdn": [
        { stdout: "t-fuse-docs-ca.internal.example.azurecontainerapps.io" },
      ],
      "containerapp show properties.configuration.ingress.traffic[?label == 'pr-38'].label": [
        { stdout: "pr-38" },
      ],
      ...replies,
    })
  );
  writeFileSync(
    join(directory, "az"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ argv }) + "\\n");
const operation = argv.slice(0, argv.findIndex((arg) => arg.startsWith("--"))).join(" ");
const query = argv[argv.indexOf("--query") + 1];
const key = operation === "containerapp show" ? operation + " " + query : operation;
const path = ${JSON.stringify(responses)};
const responses = JSON.parse(readFileSync(path, "utf8"));
const entries = responses[key] ?? [{}];
const response = entries.length > 1 ? entries.shift() : entries[0];
writeFileSync(path, JSON.stringify(responses));
process.stdout.write(response.stdout ?? "");
process.stderr.write(response.stderr ?? "");
process.exit(response.status ?? 0);
`,
    { mode: 0o755 }
  );
  try {
    const result = spawnSync("bash", [script, mode], {
      encoding: "utf8",
      timeout: 5_000,
      env: {
        ...process.env,
        PATH: `${directory}:${dirname(process.execPath)}:/usr/bin:/bin`,
        APP: app,
        RESOURCE_GROUP: mode === "prod" ? "p-fuse-cae" : "t-fuse-cae",
        ENVIRONMENT: mode === "prod" ? "p-fuse-cae-01" : "t-fuse-cae-01",
        REGISTRY: mode === "prod" ? "pfusecr" : "tfusecr",
        MANAGED_IDENTITY_ID: mode === "prod" ? "/identities/prod" : "/identities/preview",
        IMAGE: mode === "prod" ? "pfusecr.azurecr.io/fuse-docs:abc" : "tfusecr.azurecr.io/fuse-docs:abc",
        SUFFIX: suffix,
        PR: "38",
        GITHUB_OUTPUT: output,
      },
    });
    const calls = readFileSync(trace, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const entry = asRecord(JSON.parse(line), "Azure invocation");
        if (!Array.isArray(entry.argv)) throw new Error("Azure argv is not an array");
        return entry.argv.map((arg) => asString(arg, "Azure argument"));
      });
    return { ...result, calls, output: readFileSync(output, "utf8") };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** @param {string[][]} calls @param {string} command */
function invocations(calls, command) {
  const prefix = command.split(" ");
  return calls.filter((args) => prefix.every((part, index) => args[index] === part));
}

/** @param {string[]} args @param {string} flag */
function value(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) throw new Error(`Missing Azure flag: ${flag}`);
  return args[index + 1];
}

describe("docs Container App deployment", () => {
  it.each([
    ["prod", "single", "1", "r-9001-1", "pfusecr.azurecr.io", "/identities/prod"],
    ["preview", "multiple", "0", "bootstrap", "tfusecr.azurecr.io", "/identities/preview"],
  ])(
    "creates a missing %s app with its runtime identity and scaling",
    (mode, revisionMode, minimum, suffix, registry, identity) => {
      const result = deploy(mode, { "containerapp list": [{ stdout: "" }] });
      expect(result.status, result.stderr).toBe(0);
      const creates = invocations(result.calls, "containerapp create");
      expect(creates).toHaveLength(1);
      const create = creates[0];
      expect(value(create, "--registry-server")).toBe(registry);
      expect(value(create, "--registry-identity")).toBe(identity);
      expect(value(create, "--user-assigned")).toBe(identity);
      expect(value(create, "--revisions-mode")).toBe(revisionMode);
      expect(value(create, "--revision-suffix")).toBe(suffix);
      expect(value(create, "--min-replicas")).toBe(minimum);
      expect(value(create, "--max-replicas")).toBe("3");
      expect(value(create, "--ingress")).toBe("external");
      expect(value(create, "--target-port")).toBe("3000");
      expect(value(create, "--scale-rule-type")).toBe("http");
      expect(value(create, "--scale-rule-http-concurrency")).toBe("50");
      if (mode === "prod") {
        expect(value(create, "--name")).toBe("p-fuse-docs-ca");
        expect(value(create, "--resource-group")).toBe("p-fuse-cae");
        expect(value(create, "--environment")).toBe("p-fuse-cae-01");
        expect(invocations(result.calls, "containerapp update")).toHaveLength(0);
      } else {
        expect(value(create, "--name")).toBe("t-fuse-docs-ca");
        expect(value(create, "--resource-group")).toBe("t-fuse-cae");
        expect(value(create, "--environment")).toBe("t-fuse-cae-01");
        const traffic = invocations(result.calls, "containerapp ingress traffic set")[0];
        const update = invocations(result.calls, "containerapp update")[0];
        expect(value(traffic, "--revision-weight")).toBe("t-fuse-docs-ca--bootstrap=100");
        expect(result.calls.indexOf(traffic)).toBeLessThan(result.calls.indexOf(update));
        expect(value(update, "--revision-suffix")).toBe("pr-38-9001-1");
        expect(result.output).toBe(
          "url=https://t-fuse-docs-ca---pr-38.internal.example.azurecontainerapps.io\nrevision=t-fuse-docs-ca--pr-38-9001-1\n"
        );
      }
    }
  );

  it("updates existing production without trying to recreate it", () => {
    const result = deploy("prod");
    expect(result.status, result.stderr).toBe(0);
    expect(invocations(result.calls, "containerapp create")).toHaveLength(0);
    const update = invocations(result.calls, "containerapp update")[0];
    expect(value(update, "--image")).toBe("pfusecr.azurecr.io/fuse-docs:abc");
    expect(value(update, "--revision-suffix")).toBe("r-9001-1");
  });

  it("can redeploy an existing production app after a failed rollout", () => {
    const result = deploy("prod", {
      "containerapp show properties.provisioningState": [{ stdout: "Failed" }],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(invocations(result.calls, "containerapp update")).toHaveLength(1);
  });

  it("moves the preview label before retiring only older revisions of that PR", () => {
    const result = deploy("preview", {
      "containerapp revision list": [
        {
          stdout:
            "t-fuse-docs-ca--bootstrap\nt-fuse-docs-ca--pr-38-8000-1\nt-fuse-docs-ca--pr-39-8000-1\nt-fuse-docs-ca--pr-38-9001-1\n",
        },
      ],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(invocations(result.calls, "containerapp create")).toHaveLength(0);
    const label = invocations(result.calls, "containerapp revision label add")[0];
    expect(value(label, "--revision")).toBe("t-fuse-docs-ca--pr-38-9001-1");
    expect(value(label, "--label")).toBe("pr-38");
    const retired = invocations(result.calls, "containerapp revision deactivate");
    expect(retired.map((args) => value(args, "--revision"))).toEqual(["t-fuse-docs-ca--pr-38-8000-1"]);
    expect(result.calls.indexOf(label)).toBeLessThan(result.calls.indexOf(retired[0]));
  });

  it("recovers when another PR creates the shared app first", () => {
    const result = deploy("preview", {
      "containerapp list": [{ stdout: "" }, { stdout: "t-fuse-docs-ca" }],
      "containerapp create": [{ status: 1, stderr: "App already exists" }],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(invocations(result.calls, "containerapp update")).toHaveLength(1);
    expect(invocations(result.calls, "containerapp ingress traffic set")).toHaveLength(1);
  });

  it.each([
    ["inventory failure", { "containerapp list": [{ status: 1, stderr: "AuthorizationFailed" }] }],
    [
      "create failure",
      {
        "containerapp list": [{ stdout: "" }],
        "containerapp create": [{ status: 1, stderr: "Identity assignment denied" }],
      },
    ],
    [
      "failed provisioning",
      {
        "containerapp list": [{ stdout: "" }],
        "containerapp show properties.provisioningState": [{ stdout: "Failed" }],
      },
    ],
    ["label failure", { "containerapp revision label add": [{ status: 1, stderr: "Revision not ready" }] }],
  ])("fails closed on %s without retiring a working preview", (_name, replies) => {
    const result = deploy("preview", replies);
    expect(result.status).not.toBe(0);
    expect(invocations(result.calls, "containerapp revision deactivate")).toHaveLength(0);
    expect(result.output).toBe("");
    if (_name === "inventory failure") {
      expect(invocations(result.calls, "containerapp create")).toHaveLength(0);
    }
  });

  it("makes teardown a no-op if no app was ever created", () => {
    const result = deploy("teardown", { "containerapp list": [{ stdout: "" }] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toHaveLength(1);
  });

  it.each(["pr-38", ""])("removes only the closed PR's revisions when its label is '%s'", (label) => {
    const result = deploy("teardown", {
      "containerapp show properties.configuration.ingress.traffic[?label == 'pr-38'].label": [
        { stdout: label },
      ],
      "containerapp revision list": [
        { stdout: "t-fuse-docs-ca--bootstrap\nt-fuse-docs-ca--pr-38-8000-1\nt-fuse-docs-ca--pr-39-8000-1\n" },
      ],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(invocations(result.calls, "containerapp revision label remove")).toHaveLength(label ? 1 : 0);
    expect(
      invocations(result.calls, "containerapp revision deactivate").map((args) => value(args, "--revision"))
    ).toEqual(["t-fuse-docs-ca--pr-38-8000-1"]);
    expect(invocations(result.calls, "containerapp create")).toHaveLength(0);
  });
});
