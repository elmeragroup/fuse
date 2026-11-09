import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * The arguments the `figma` script passes to Node. The env-file flag is dropped so a
 * developer's local `.env` cannot supply FIGMA_TOKEN to a test that runs without one.
 */
function figmaScriptArguments(): string[] {
  return nodeArguments(packageJson.scripts.figma);
}

/** The arguments a package script passes to Node, without the env-file flag, as above. */
function nodeArguments(script: string): string[] {
  const [command, ...args] = script.split(/\s+/);
  expect(command).toBe("node");
  return args.filter((arg) => !arg.startsWith("--env-file"));
}

/** Preloaded after the package's loader, it makes `vitest` unresolvable. */
const WITHOUT_VITEST = fileURLToPath(new URL("fixtures/without-vitest.mjs", import.meta.url));

describe("the Node entry point", () => {
  // Vitest transforms TSX and extensionless imports on its own, so only a real Node run
  // proves the theme catalog stays loadable by the `figma` script.
  it("loads the theme catalog under plain Node and prints help without a token", () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "FIGMA_TOKEN"));
    const result = spawnSync(process.execPath, [...figmaScriptArguments(), "--help"], {
      cwd: packageRoot,
      encoding: "utf8",
      env,
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("sync");
    expect(result.stdout).toContain("check");
  });

  it("exits 1 when a check cannot run, which keeps exit 2 for drift", () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "FIGMA_TOKEN"));
    const result = spawnSync(process.execPath, [...figmaScriptArguments(), "check", "--file-key", "abc"], {
      cwd: packageRoot,
      encoding: "utf8",
      env,
    });

    expect(result.stderr).toContain("Set FIGMA_TOKEN to a Figma personal access token");
    expect(result.status).toBe(1);
  });

  // The compare CLI checks client cells' markup, and the check lives in `src`, so the CLI loads
  // without the test runner. An out-of-range threshold stops the run after every module loaded and
  // before it writes anything.
  it("loads the compare entry under plain Node without Vitest", () => {
    const [, ...args] = nodeArguments(packageJson.scripts["figma:compare"]);
    const entry = args.at(-1) ?? "";
    const result = spawnSync(
      process.execPath,
      [...args.slice(0, -1), "--import", WITHOUT_VITEST, entry, "--threshold", "2"],
      { cwd: packageRoot, encoding: "utf8" }
    );

    expect(result.stderr).toBe("--threshold takes a number from 0 to 1, not 2\n");
    expect(result.status).toBe(1);
  });
});
