import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Fiber, Layer } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Gh } from "../src/gh.ts";

const fakeGh = (repoRoot: string) =>
  Gh.layerWith({
    repoRoot,
    executable: process.execPath,
    baseArgs: [path.join(import.meta.dirname, "fixture/fake-gh.mjs")],
  }).pipe(Layer.provide(NodeServices.layer));

const workDir = Effect.acquireRelease(
  Effect.promise(() => mkdtemp(path.join(tmpdir(), "pr-shots-gh-"))),
  (dir) => Effect.promise(() => rm(dir, { recursive: true, force: true }))
);

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("Gh", () => {
  it.live("returns gh's output", () =>
    Effect.gen(function* () {
      const cwd = yield* workDir;
      const gh = yield* Gh;
      assert.strictEqual(yield* gh.edit(["pr", "edit", "182"], cwd), "pr edit 182");
    }).pipe(Effect.scoped, Effect.provide(fakeGh(tmpdir())))
  );

  it.live("fails with gh's stderr", () =>
    Effect.gen(function* () {
      const cwd = yield* workDir;
      const gh = yield* Gh;
      const failure = yield* Effect.flip(gh.edit(["fail"], cwd));
      assert.strictEqual(failure.message, "gh could not edit the PR: fake gh refused");
    }).pipe(Effect.scoped, Effect.provide(fakeGh(tmpdir())))
  );

  it.live("kills gh and waits for it to exit when the upload is interrupted", () =>
    Effect.gen(function* () {
      const cwd = yield* workDir;
      const gh = yield* Gh;
      const upload = yield* Effect.forkChild(gh.edit(["hang"], cwd));
      const pidFile = path.join(cwd, "fake-gh.pid");
      let pid = Number.NaN;
      for (let attempt = 0; attempt < 100 && Number.isNaN(pid); attempt += 1) {
        yield* Effect.sleep(Duration.millis(50));
        pid = yield* Effect.promise(() => readFile(pidFile, "utf8").then(Number, () => Number.NaN));
      }
      assert.isTrue(isAlive(pid));

      yield* Fiber.interrupt(upload);

      // Fiber.interrupt returns once the finalizers ran, so gh is already gone.
      assert.isFalse(isAlive(pid));
    }).pipe(Effect.scoped, Effect.provide(fakeGh(tmpdir())))
  );
});
