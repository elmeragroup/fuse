import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Deferred, Duration, Effect, Fiber, Layer } from "effect";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { DocsServer } from "../src/docs-server.ts";
import type { DocsServerConfig } from "../src/docs-server.ts";

const ORIGINAL = '/// <reference types="next" />\n// the checked-in original\n';
const REWRITTEN = "// rewritten by the fake server\n";
const ROUTE = "/components/button";

/** A docs server whose process is the fake in `fixture/fake-docs-server.mjs`, run in `cwd`. */
function fakeServer(
  cwd: string,
  overrides: Partial<DocsServerConfig> & {
    readonly mode?: "serve" | "hang" | "exit-code" | "exit-signal";
  } = {}
) {
  const { mode = "serve", ...config } = overrides;
  return DocsServer.layerWith({
    name: "fake server",
    cwd,
    command: (port) => ({
      executable: process.execPath,
      args: [path.join(import.meta.dirname, "fixture/fake-docs-server.mjs"), "launcher", String(port), mode],
      env: {},
    }),
    restoredFile: path.join(cwd, "next-env.d.ts"),
    readyTimeout: Duration.seconds(20),
    // The fake launcher ignores SIGTERM, so every stop waits this long before its SIGKILL.
    forceKillAfter: Duration.millis(100),
    lockFile: path.join(cwd, "cache/pr-shots.lock"),
    ...config,
  }).pipe(Layer.provide(NodeServices.layer));
}

/** A temp directory holding the original `next-env.d.ts`, removed with the scope. */
const checkout = Effect.acquireRelease(
  Effect.promise(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pr-shots-docs-"));
    await writeFile(path.join(dir, "next-env.d.ts"), ORIGINAL);
    return dir;
  }),
  (dir) => Effect.promise(() => rm(dir, { recursive: true, force: true }))
);

const readText = (file: string) => Effect.promise(() => readFile(file, "utf8"));

/** The pids the fake server's processes logged, by role. */
function loggedPids(cwd: string) {
  return Effect.promise(() =>
    readFile(path.join(cwd, "fake-server.log"), "utf8").then(
      (log) =>
        log
          .trim()
          .split("\n")
          .map((line) => line.split(" "))
          .map(([role, pid]) => ({ role, pid: Number(pid) })),
      () => []
    )
  );
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Waits up to three seconds for every pid to be gone, then reports which are left. */
function survivors(pids: readonly number[]) {
  return Effect.gen(function* () {
    for (let attempt = 0; attempt < 30 && pids.some(isAlive); attempt += 1) {
      yield* Effect.sleep(Duration.millis(100));
    }
    return pids.filter(isAlive);
  });
}

/** Whether a file exists. */
function exists(file: string) {
  return Effect.promise(() =>
    readFile(file).then(
      () => true,
      () => false
    )
  );
}

/** Whether anything still answers on the origin. */
function answers(origin: URL) {
  return Effect.promise(() =>
    fetch(origin).then(
      () => true,
      () => false
    )
  );
}

/** Starts the server in a fiber that keeps it until interrupted, like a run taking shots. */
function startAndHold(layer: ReturnType<typeof fakeServer>) {
  return Effect.gen(function* () {
    const serving = yield* Deferred.make<URL>();
    const fiber = yield* Effect.forkChild(
      Effect.scoped(
        Effect.gen(function* () {
          const docs = yield* DocsServer;
          yield* Deferred.succeed(serving, yield* (yield* docs.reserve).start(ROUTE));
          return yield* Effect.never;
        })
      ).pipe(Effect.provide(layer))
    );
    return { fiber, origin: yield* Deferred.await(serving) };
  });
}

/** Runs one start to completion inside its own scope. */
function startOnce(layer: ReturnType<typeof fakeServer>) {
  return Effect.scoped(
    Effect.gen(function* () {
      const docs = yield* DocsServer;
      return yield* (yield* docs.reserve).start(ROUTE);
    })
  ).pipe(Effect.provide(layer));
}

describe("DocsServer", () => {
  it.live(
    "records the process group and the snapshot while it runs, then stops the whole group, restores next-env.d.ts and removes the record when the run is interrupted",
    () =>
      Effect.gen(function* () {
        const cwd = yield* checkout;
        const recordFile = path.join(cwd, "cache/pr-shots.lock.server.json");
        const { fiber, origin } = yield* startAndHold(fakeServer(cwd));
        assert.isTrue(yield* answers(origin));
        assert.strictEqual(yield* readText(path.join(cwd, "next-env.d.ts")), REWRITTEN);
        const pids = yield* loggedPids(cwd);
        assert.deepStrictEqual(
          pids.map(({ role }) => role),
          ["launcher", "worker"]
        );
        assert.deepStrictEqual(JSON.parse(yield* readText(recordFile)), {
          group: pids[0]?.pid,
          file: path.join(cwd, "next-env.d.ts"),
          snapshot: { _tag: "content", content: ORIGINAL },
        });

        yield* Fiber.interrupt(fiber);

        assert.deepStrictEqual(yield* survivors(pids.map(({ pid }) => pid)), []);
        assert.isFalse(yield* answers(origin));
        assert.strictEqual(yield* readText(path.join(cwd, "next-env.d.ts")), ORIGINAL);
        assert.isFalse(yield* exists(recordFile));
      }).pipe(Effect.scoped)
  );

  for (const mode of ["exit-code", "exit-signal"] as const) {
    it.live(`kills a worker that outlives its launcher (${mode}) before it restores and unlocks`, () =>
      Effect.gen(function* () {
        const cwd = yield* checkout;
        // Whether the start fails on the launcher's exit or serves first depends on timing;
        // either way the scope closes here.
        yield* Effect.exit(startOnce(fakeServer(cwd, { mode })));

        const pids = yield* loggedPids(cwd);
        assert.deepStrictEqual(
          pids.map(({ role }) => role),
          ["launcher", "worker"]
        );
        // No waiting: the scope closed only once the whole group was gone.
        assert.deepStrictEqual(pids.map(({ pid }) => pid).filter(isAlive), []);
        // The worker rewrote next-env.d.ts every 20 ms while it lived, so the original is
        // there only if the restore ran after it died.
        yield* Effect.sleep(Duration.millis(100));
        assert.strictEqual(yield* readText(path.join(cwd, "next-env.d.ts")), ORIGINAL);
        const lock = yield* Effect.promise(() =>
          readFile(path.join(cwd, "cache/pr-shots.lock")).then(
            () => "present",
            () => "gone"
          )
        );
        assert.strictEqual(lock, "gone");
      }).pipe(Effect.scoped)
    );
  }

  it.live("fails with DocsServerFailed when the command cannot start", () =>
    Effect.gen(function* () {
      const cwd = yield* checkout;
      const failure = yield* Effect.flip(
        startOnce(
          fakeServer(cwd, {
            command: () => ({ executable: path.join(cwd, "no-such-node"), args: [], env: {} }),
          })
        )
      );
      assert.strictEqual(failure._tag, "DocsServerFailed");
      assert.include(failure.message, "fake server could not start");
      assert.strictEqual(yield* readText(path.join(cwd, "next-env.d.ts")), ORIGINAL);
    }).pipe(Effect.scoped)
  );

  it.live("gives up at the ready timeout on a server that accepts a request and never answers", () =>
    Effect.gen(function* () {
      const cwd = yield* checkout;
      const failure = yield* Effect.flip(
        startOnce(fakeServer(cwd, { mode: "hang", readyTimeout: Duration.seconds(2) }))
      );
      assert.strictEqual(failure._tag, "DocsServerFailed");
      assert.include(failure.message, `fake server did not serve ${ROUTE} within 2s`);
      const pids = yield* loggedPids(cwd);
      assert.strictEqual(pids.length, 2);
      assert.deepStrictEqual(yield* survivors(pids.map(({ pid }) => pid)), []);
      assert.strictEqual(yield* readText(path.join(cwd, "next-env.d.ts")), ORIGINAL);
    }).pipe(Effect.scoped, Effect.timeout(Duration.seconds(20)))
  );

  it.live("fails before starting anything when next-env.d.ts exists but cannot be read", () =>
    Effect.gen(function* () {
      const cwd = yield* checkout;
      const nextEnv = path.join(cwd, "next-env.d.ts");
      yield* Effect.promise(() => chmod(nextEnv, 0o000));
      const failure = yield* Effect.flip(startOnce(fakeServer(cwd)));
      yield* Effect.promise(() => chmod(nextEnv, 0o644));

      assert.strictEqual(failure._tag, "DocsServerFailed");
      assert.include(failure.message, `Could not read ${nextEnv}`);
      assert.include(failure.message, "EACCES");
      assert.deepStrictEqual(yield* loggedPids(cwd), []);
      assert.strictEqual(yield* readText(nextEnv), ORIGINAL);
    }).pipe(Effect.scoped)
  );

  it.live("refuses a second run on the same checkout and names the run that holds it", () =>
    Effect.gen(function* () {
      const cwd = yield* checkout;
      const { fiber } = yield* startAndHold(fakeServer(cwd));

      const second = yield* Effect.flip(startOnce(fakeServer(cwd)));
      assert.strictEqual(second._tag, "DocsServerFailed");
      assert.include(second.message, `pid ${String(process.pid)}`);
      // The second run started no process and left the first run's rewrite alone.
      assert.strictEqual((yield* loggedPids(cwd)).length, 2);
      assert.strictEqual(yield* readText(path.join(cwd, "next-env.d.ts")), REWRITTEN);

      yield* Fiber.interrupt(fiber);
      assert.strictEqual(yield* readText(path.join(cwd, "next-env.d.ts")), ORIGINAL);
    }).pipe(Effect.scoped)
  );

  it.live("keeps the crash record when the restore fails, and the next start recovers the file from it", () =>
    Effect.gen(function* () {
      const cwd = yield* checkout;
      const nextEnv = path.join(cwd, "next-env.d.ts");
      const recordFile = path.join(cwd, "cache/pr-shots.lock.server.json");
      const { fiber } = yield* startAndHold(fakeServer(cwd));
      assert.strictEqual(yield* readText(nextEnv), REWRITTEN);
      // The restore cannot write the file back.
      yield* Effect.promise(() => chmod(nextEnv, 0o444));

      yield* Fiber.interrupt(fiber);
      yield* Effect.promise(() => chmod(nextEnv, 0o644));
      assert.strictEqual(yield* readText(nextEnv), REWRITTEN);
      assert.isTrue(yield* exists(recordFile));
      const record: unknown = JSON.parse(yield* readText(recordFile));
      assert.deepInclude(record, { snapshot: { _tag: "content", content: ORIGINAL } });

      // The lock was freed. A start that still cannot write the file reports it and keeps the
      // record.
      yield* Effect.promise(() => chmod(nextEnv, 0o444));
      const blocked = yield* Effect.flip(startOnce(fakeServer(cwd)));
      yield* Effect.promise(() => chmod(nextEnv, 0o644));
      assert.strictEqual(blocked._tag, "DocsServerFailed");
      assert.include(blocked.message, `Could not restore ${nextEnv}: EACCES`);
      assert.include(blocked.message, `${recordFile} keeps what it held`);
      assert.isTrue(yield* exists(recordFile));

      // Once it can, the next start puts the original back before it snapshots.
      const { fiber: next } = yield* startAndHold(fakeServer(cwd));
      yield* Fiber.interrupt(next);
      assert.strictEqual(yield* readText(nextEnv), ORIGINAL);
      assert.isFalse(yield* exists(recordFile));
    }).pipe(Effect.scoped)
  );
});
