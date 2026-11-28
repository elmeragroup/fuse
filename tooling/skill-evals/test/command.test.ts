import { NodeServices } from "@effect/platform-node";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { runCommand } from "../src/command.ts";

// Unit under test: `runCommand`'s deadline. Oracle: the timeout the caller sets, and the POSIX rule
// that signal 0 to a process id fails once that process is gone.

/** A leader that starts a grandchild on its own stdout, prints the grandchild's pid and exits. */
const LEADER = `
  const child = require("node:child_process").spawn(
    process.execPath,
    ["-e", "setTimeout(() => {}, 60000)"],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
  console.log(child.pid);
  child.unref();
`;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("runCommand", () => {
  it("times out when a grandchild holds stdout open after the leader exits, and stops it", async () => {
    const run = await Effect.runPromise(
      runCommand({
        executable: process.execPath,
        args: ["-e", LEADER],
        cwd: tmpdir(),
        env: { PATH: process.env.PATH ?? "" },
        timeout: Duration.seconds(2),
      }).pipe(Effect.provide(NodeServices.layer))
    );
    expect(run.outcome._tag).toBe("timed-out");
    const grandchild = Number(run.stdout.trim());
    expect(Number.isInteger(grandchild) && grandchild > 0).toBe(true);
    expect(isAlive(grandchild)).toBe(false);
  });

  it("passes only the environment it is given", async () => {
    const run = await Effect.runPromise(
      runCommand({
        executable: process.execPath,
        args: ["-e", "console.log(JSON.stringify(Object.keys(process.env).sort()))"],
        cwd: tmpdir(),
        env: { ONLY_THIS: "1" },
        timeout: Duration.seconds(10),
      }).pipe(Effect.provide(NodeServices.layer))
    );
    expect(run.outcome).toEqual({ _tag: "exited", exitCode: 0 });
    expect(JSON.parse(run.stdout)).not.toContain("HOME");
    expect(JSON.parse(run.stdout)).toContain("ONLY_THIS");
  });
});
