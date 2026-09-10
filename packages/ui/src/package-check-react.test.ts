import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { checkPackedReactCompatibility } from "../scripts/package-check-react";
import { RELEASE_AGE_MINUTES, releaseAgeCutoff } from "../scripts/packed-consumer-install-policy";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tarball = "/nonexistent/elmera-ui.tgz";

type SpawnCall = { command: string; args: readonly string[]; cwd: string };
type SpawnResult = { status: number; stdout: string; stderr: string };

function installedVersion(name: string): string {
  // SAFETY: Node resolves the installed dependency's package manifest.
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
    version: string;
  };
  return manifest.version;
}

function workspaceReleaseAgeMinutes(): number {
  const workspace = readFileSync(join(packageRoot, "../../pnpm-workspace.yaml"), "utf8");
  const match = /^minimumReleaseAge: (\d+)$/m.exec(workspace);
  if (match?.[1] === undefined) {
    throw new Error("pnpm-workspace.yaml has no minimumReleaseAge line");
  }
  return Number(match[1]);
}

describe("packed consumer install policy", () => {
  it("mirrors minimumReleaseAge from pnpm-workspace.yaml", () => {
    expect(RELEASE_AGE_MINUTES).toBe(workspaceReleaseAgeMinutes());
  });

  it("computes an absolute UTC cutoff 72 hours before now", () => {
    expect(releaseAgeCutoff(new Date("2026-09-08T12:00:00.000Z"))).toBe("2026-09-05T12:00:00.000Z");
  });

  it("crosses a non-leap-year month boundary", () => {
    expect(releaseAgeCutoff(new Date("2026-03-02T01:30:00.000Z"))).toBe("2026-02-27T01:30:00.000Z");
  });
});

describe("packed React consumer installs", () => {
  const scratchDirs: string[] = [];

  afterEach(() => {
    for (const directory of scratchDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it("installs three consumers with one shared --before cutoff, then probes each", () => {
    const calls: SpawnCall[] = [];
    const spawn = (command: string, args: readonly string[], options: { cwd: string }): SpawnResult => {
      calls.push({ command, args, cwd: options.cwd });
      scratchDirs.push(options.cwd);
      return { status: 0, stdout: "{}", stderr: "" };
    };

    checkPackedReactCompatibility(tarball, { spawn, now: new Date("2026-09-08T12:00:00.000Z") });

    expect(calls).toHaveLength(6);
    expect(calls.map((call) => call.command)).toEqual([
      "npm",
      process.execPath,
      "npm",
      process.execPath,
      "npm",
      process.execPath,
    ]);
    const installs = calls.filter((call) => call.command === "npm");
    const probes = calls.filter((call) => call.command === process.execPath);
    expect(installs).toHaveLength(3);
    expect(probes).toHaveLength(3);
    for (const install of installs) {
      expect(install.args[0]).toBe("install");
      expect(install.args).toContain("--ignore-scripts");
      expect(install.args).toContain("--before=2026-09-05T12:00:00.000Z");
    }
    const installCwds = installs.map((install) => install.cwd);
    expect(new Set(installCwds).size).toBe(3);
    for (const cwd of installCwds) {
      expect(existsSync(cwd)).toBe(false);
    }
  });

  it("writes a file: tarball spec and the three React pairs into each consumer", () => {
    const manifests: unknown[] = [];
    const spawn = (command: string, _args: readonly string[], options: { cwd: string }): SpawnResult => {
      scratchDirs.push(options.cwd);
      if (command === "npm") {
        manifests.push(JSON.parse(readFileSync(join(options.cwd, "package.json"), "utf8")));
      }
      return { status: 0, stdout: "{}", stderr: "" };
    };

    checkPackedReactCompatibility(tarball, { spawn, now: new Date("2026-09-08T12:00:00.000Z") });

    expect(manifests).toEqual([
      {
        private: true,
        type: "module",
        dependencies: {
          "@elmeragroup/ui": `file:${tarball}`,
          react: "19.0.0",
          "react-dom": "19.0.0",
        },
      },
      {
        private: true,
        type: "module",
        dependencies: {
          "@elmeragroup/ui": `file:${tarball}`,
          react: "19.1.1",
          "react-dom": "19.1.1",
        },
      },
      {
        private: true,
        type: "module",
        dependencies: {
          "@elmeragroup/ui": `file:${tarball}`,
          react: installedVersion("react"),
          "react-dom": installedVersion("react-dom"),
        },
      },
    ]);
  });

  it("stops before the probe when an install misses the cutoff and removes every consumer", () => {
    const calls: SpawnCall[] = [];
    let npmCalls = 0;
    const spawn = (command: string, args: readonly string[], options: { cwd: string }): SpawnResult => {
      calls.push({ command, args, cwd: options.cwd });
      scratchDirs.push(options.cwd);
      if (command === "npm") {
        npmCalls += 1;
        if (npmCalls === 2) {
          return {
            status: 1,
            stdout: "",
            stderr: "npm ERR! No matching version found for react@19.1.1 before 2026-09-05",
          };
        }
      }
      return { status: 0, stdout: "{}", stderr: "" };
    };

    try {
      checkPackedReactCompatibility(tarball, { spawn, now: new Date("2026-09-08T12:00:00.000Z") });
      expect.fail("expected install failure");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw error;
      expect(error.message.startsWith("Packed React 19.1.1 install failed:")).toBe(true);
      expect(error.message).toContain(
        "npm ERR! No matching version found for react@19.1.1 before 2026-09-05"
      );
    }

    expect(calls.map((call) => call.command)).toEqual(["npm", process.execPath, "npm"]);
    for (const call of calls) {
      expect(existsSync(call.cwd)).toBe(false);
    }
  });
});
