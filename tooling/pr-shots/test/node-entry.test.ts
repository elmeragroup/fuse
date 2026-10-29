import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import rootPackageJson from "../../../package.json" with { type: "json" };

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

/** The arguments the root `shots` script passes to Node. */
function shotsScriptArguments(): string[] {
  const [command, ...args] = rootPackageJson.scripts.shots.split(/\s+/);
  expect(command).toBe("node");
  return args;
}

describe("the Node entry point", () => {
  // Vitest transforms TypeScript on its own, so only a real Node run proves the `shots` script
  // loads the Effect modules by stripping types, and that the runtime exits with the status the
  // command line sets. `cli.test.ts` owns the help text and each parse error.
  it("loads under plain Node and exits 2 on a command line that does not parse", () => {
    const result = spawnSync(
      process.execPath,
      [...shotsScriptArguments(), "phone-dial", "--route", "components/x"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      }
    );

    expect(result.stderr).toContain('Invalid value for flag --route: "components/x"');
    expect(result.status).toBe(2);
  });
});
