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
  const [command, ...args] = packageJson.scripts.figma.split(/\s+/);
  expect(command).toBe("node");
  return args.filter((arg) => !arg.startsWith("--env-file"));
}

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
});
