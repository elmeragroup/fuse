import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Deferred, Duration, Effect, Fiber } from "effect";
import { spawnSync } from "node:child_process";
import { mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { holdLock } from "../src/file-lock.ts";

/**
 * How many times each race runs, since one lucky interleaving proves nothing. A lock without a
 * safe reclaim let both runs win within the first 250 rounds of the reclaim race.
 */
const ROUNDS = 200;

const tempDir = Effect.acquireRelease(
  Effect.promise(() => mkdtemp(path.join(tmpdir(), "pr-shots-lock-"))),
  (dir) => Effect.promise(() => rm(dir, { recursive: true, force: true }))
);

/** A pid that belonged to a process that has already exited. */
function deadPid(): number {
  const finished = spawnSync(process.execPath, ["-e", ""]);
  return finished.pid;
}

/**
 * Two runs racing for the lock. A winner holds the lock until the other run's attempt has
 * finished, for at most two seconds, so two winners mean two runs held the lock at once. Each
 * winner reads the lock file while it holds it.
 */
function race(file: string) {
  return Effect.gen(function* () {
    const finished = [yield* Deferred.make<void>(), yield* Deferred.make<void>()] as const;
    const run = (self: Deferred.Deferred<void>, other: Deferred.Deferred<void>) =>
      Effect.scoped(
        Effect.gen(function* () {
          yield* holdLock(file, "the test resource");
          const record = yield* Effect.promise(() => readFile(file, "utf8"));
          yield* Deferred.await(other).pipe(Effect.timeout(Duration.seconds(2)), Effect.ignore);
          return { _tag: "won" as const, record };
        })
      ).pipe(
        Effect.catchTag("LockHeld", () => Effect.succeed({ _tag: "held" as const })),
        Effect.ensuring(Deferred.succeed(self, undefined))
      );
    return yield* Effect.all([run(finished[0], finished[1]), run(finished[1], finished[0])], {
      concurrency: 2,
    });
  });
}

/** One run's try for a lock nobody else is racing for. */
function attempt(file: string) {
  return Effect.scoped(holdLock(file, "the test resource").pipe(Effect.as({ _tag: "won" as const }))).pipe(
    Effect.catchTag("LockHeld", () => Effect.succeed({ _tag: "held" as const }))
  );
}

describe("holdLock", () => {
  it.live(
    "lets exactly one of two runs started at the same instant take the lock",
    () =>
      Effect.gen(function* () {
        const dir = yield* tempDir;
        for (let round = 0; round < ROUNDS; round += 1) {
          const file = path.join(dir, `round-${String(round)}/run.lock`);
          const results = yield* race(file);
          assert.deepStrictEqual(
            results.map(({ _tag }) => _tag).sort(),
            ["held", "won"],
            `round ${String(round)}`
          );
        }
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    { timeout: 120_000 }
  );

  it.live(
    "lets one of two runs reclaim a stale lock and keeps the other off the fresh one",
    () =>
      Effect.gen(function* () {
        const dir = yield* tempDir;
        for (let round = 0; round < ROUNDS; round += 1) {
          const file = path.join(dir, `round-${String(round)}.lock`);
          const stale = JSON.stringify({ pid: deadPid(), token: "stale" });
          yield* Effect.promise(() => writeFile(file, stale));
          const results = yield* race(file);
          assert.deepStrictEqual(
            results.map(({ _tag }) => _tag).sort(),
            ["held", "won"],
            `round ${String(round)}`
          );
          // The winner held a lock of its own, not the stale record.
          const won = results.find((result) => result._tag === "won");
          assert.isTrue(won !== undefined && won.record !== stale);
        }
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    { timeout: 120_000 }
  );

  // The reclaim race made deterministic. The lock file starts as a named pipe, so the run's read
  // of it blocks until the test writes a stale record. Before that read ends, the test renames a
  // live run's fresh lock over the path, which is what another run's reclaim does. The run has
  // now judged a record stale that is no longer at the path, and must leave the fresh lock alone.
  it.live("never removes a lock another run created after it judged the old one stale", () =>
    Effect.gen(function* () {
      const dir = yield* tempDir;
      const file = path.join(dir, "run.lock");
      const fresh = JSON.stringify({ pid: process.pid, token: "fresh" });
      const freshFile = path.join(dir, "fresh.tmp");
      yield* Effect.promise(() => writeFile(freshFile, fresh));
      assert.strictEqual(spawnSync("mkfifo", [file]).status, 0);

      const reclaimer = yield* Effect.forkChild(attempt(file));
      // Opening the pipe for writing returns once the run has opened it for reading.
      const writer = yield* Effect.promise(() => open(file, "w"));
      yield* Effect.promise(() => writer.write(JSON.stringify({ pid: deadPid(), token: "stale" })));
      yield* Effect.promise(() => rename(freshFile, file));
      yield* Effect.promise(() => writer.close());

      assert.strictEqual((yield* Fiber.join(reclaimer))._tag, "held");
      assert.strictEqual(yield* Effect.promise(() => readFile(file, "utf8")), fresh);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  // An empty lock file is the state a run's lock would show between creating the file and
  // writing its owner, frozen, so this is the same-instant race made deterministic.
  it.live("never takes over a lock whose owner record is incomplete", () =>
    Effect.gen(function* () {
      const dir = yield* tempDir;
      const file = path.join(dir, "run.lock");
      yield* Effect.promise(() => writeFile(file, ""));
      const failure = yield* Effect.flip(Effect.scoped(holdLock(file, "the test resource")));
      assert.strictEqual(failure._tag, "LockNeedsRecovery");
      assert.include(failure.message, `delete ${file}`);
      assert.strictEqual(yield* Effect.promise(() => readFile(file, "utf8")), "");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.live("names the pid of a live holder and frees the lock when its scope closes", () =>
    Effect.gen(function* () {
      const dir = yield* tempDir;
      const file = path.join(dir, "run.lock");
      const failure = yield* Effect.scoped(
        Effect.gen(function* () {
          yield* holdLock(file, "the test resource");
          return yield* Effect.flip(Effect.scoped(holdLock(file, "the test resource")));
        })
      );
      assert.strictEqual(failure._tag, "LockHeld");
      assert.include(
        failure.message,
        `Another pr-shots run (pid ${String(process.pid)}) is using the test resource.`
      );
      const exists = yield* Effect.promise(() =>
        readFile(file).then(
          () => true,
          () => false
        )
      );
      assert.isFalse(exists);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
