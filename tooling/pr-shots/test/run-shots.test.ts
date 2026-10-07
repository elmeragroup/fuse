import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Clock, Deferred, Duration, Effect, Fiber, Layer, Option, Queue } from "effect";
import { TestConsole } from "effect/testing";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Capture } from "../src/capture.ts";
import type { CaptureRequest } from "../src/capture.ts";
import { DocsServer, DocsServerFailed } from "../src/docs-server.ts";
import { holdLock } from "../src/file-lock.ts";
import { Gh } from "../src/gh.ts";
import { runShots } from "../src/run-shots.ts";
import { shotOptions } from "./parse-argv.ts";

/** What a stub run did. */
type Record = {
  /** Each capture request's source label and shot files, in order. */
  readonly captures: string[][];
  /** Each pull request whose body `gh` read, in order. */
  readonly ghReads: number[];
  /** Each `gh` edit's arguments. */
  readonly ghEdits: (readonly string[])[];
};

/** How the stubs behave. */
type StubOptions = {
  /** Called before a capture writes its files, such as a gate that holds the run there. */
  readonly beforeCapture?: (request: CaptureRequest) => Effect.Effect<void>;
  /** A pull request the stub gh reads and edits, shared between runs. */
  readonly pr?: SharedPullRequest;
  /** What reserving the local docs server does. */
  readonly reserve?: DocsServer["Service"]["reserve"];
};

/**
 * Services for a run without a browser, a server or gh. A capture writes each shot's file with
 * the run's label in it; gh records its arguments and succeeds.
 */
function stubs(record: Record, label: string, { beforeCapture, reserve, pr }: StubOptions = {}) {
  return Layer.mergeAll(
    Layer.succeed(
      Capture,
      Capture.of({
        probe: () => Effect.succeed(200),
        resolveFrame: () => Effect.succeed("stage"),
        capture: (request) =>
          Effect.gen(function* () {
            record.captures.push([request.sourceLabel, ...request.shots.map((shot) => shot.file)]);
            if (beforeCapture !== undefined) {
              yield* beforeCapture(request);
            }
            yield* Effect.promise(() =>
              Promise.all(request.shots.map((shot) => writeFile(path.join(request.outDir, shot.file), label)))
            );
          }),
      })
    ),
    Layer.succeed(
      DocsServer,
      DocsServer.of({
        reserve: reserve ?? Effect.succeed({ start: () => Effect.succeed(new URL("http://127.0.0.1:9/")) }),
      })
    ),
    Layer.succeed(
      Gh,
      Gh.of({
        readBody: (number) =>
          Effect.suspend(() => {
            record.ghReads.push(number);
            return pr?.read ?? Effect.succeed("## Verification\n\n- Checks pass.\n");
          }),
        edit: (args, cwd) =>
          Effect.gen(function* () {
            record.ghEdits.push(args);
            if (pr !== undefined) {
              yield* pr.write(yield* Effect.promise(() => readFile(path.join(cwd, "pr-body.md"), "utf8")));
            }
            return "https://github.com/elmeragroup/ui/pull/182";
          }),
      })
    ),
    NodeServices.layer
  );
}

/** A pid that belonged to a process that has already exited. */
function deadPid(): number {
  return spawnSync(process.execPath, ["-e", ""]).pid;
}

const newRecord = (): Record => ({ captures: [], ghReads: [], ghEdits: [] });

/** A pull request body that stub gh calls of several runs read and replace. */
type SharedPullRequest = {
  readonly read: Effect.Effect<string>;
  readonly write: (body: string) => Effect.Effect<void>;
  readonly body: () => string;
};

/**
 * A shared pull request whose body read waits until `readers` runs have asked for it, for at
 * most a second. Without a lock both runs read the old body; with one, the second cannot ask
 * until the first has written, so the first read waits out the second.
 */
function sharedPullRequest(initial: string, readers: number) {
  return Effect.gen(function* () {
    let body = initial;
    let asked = 0;
    const allAsked = yield* Deferred.make<void>();
    return {
      read: Effect.gen(function* () {
        asked += 1;
        if (asked >= readers) {
          yield* Deferred.succeed(allAsked, undefined);
        }
        yield* Deferred.await(allAsked).pipe(Effect.timeout("1 second"), Effect.ignore);
        return body;
      }),
      write: (next: string) =>
        Effect.sync(() => {
          body = next;
        }),
      body: () => body,
    } satisfies SharedPullRequest;
  });
}

/** A temporary checkout root, removed with the scope. */
const checkout = Effect.acquireRelease(
  Effect.promise(() => mkdtemp(path.join(tmpdir(), "pr-shots-run-"))),
  (dir) => Effect.promise(() => rm(dir, { recursive: true, force: true }))
);

/** Both sides on a server that is already running, so no local docs server is involved. */
const REMOTE = ["--before", "http://127.0.0.1:9/", "--after", "http://127.0.0.1:9/"];

/** Five themes, two densities and three engines: 30 pairs. */
const MATRIX = [
  "matrix",
  "--route",
  "/components/button",
  "--target",
  "button:Save",
  "--themes",
  "internal-fkas-private,external-tkas-company,external-fkse-private,internal-elma-private,external-elma-company",
  "--densities",
  "dense,comfortable",
  "--engines",
  "chromium,webkit,firefox",
  ...REMOTE,
];

/** A sleep the code under test asked for: when it ends, and the gate that ends it. */
type PendingSleep = { readonly until: number; readonly wake: Deferred.Deferred<void> };

/**
 * A clock that stands still unless the test moves it. Each sleep is posted to `sleeps` and waits
 * for the test to release it, so the test moves time only once the code under test is asleep,
 * never while it does real work, such as a lock attempt's file I/O.
 */
function steppedClock() {
  return Effect.gen(function* () {
    const sleeps = yield* Queue.unbounded<PendingSleep>();
    let now = 0;
    const nanos = () => BigInt(now) * 1_000_000n;
    const clock: Clock.Clock = {
      currentTimeMillisUnsafe: () => now,
      currentTimeMillis: Effect.sync(() => now),
      currentTimeNanosUnsafe: nanos,
      currentTimeNanos: Effect.sync(nanos),
      monotonicTimeNanosUnsafe: nanos,
      monotonicTimeNanos: Effect.sync(nanos),
      sleep: (duration) =>
        Effect.gen(function* () {
          const wake = yield* Deferred.make<void>();
          yield* Queue.offer(sleeps, { until: now + Duration.toMillis(duration), wake });
          yield* Deferred.await(wake);
        }),
    };
    /** Moves time to the end of `sleep` and lets it finish. */
    const release = (sleep: PendingSleep) =>
      Effect.sync(() => {
        now = sleep.until;
      }).pipe(Effect.andThen(Deferred.succeed(sleep.wake, undefined)));
    return { clock, sleeps, release };
  });
}

/** The files in a run's output directory, with their contents. */
function outputOf(root: string, name: string) {
  return Effect.promise(async () => {
    const dir = path.join(root, ".scratch/shots", name);
    const files = (await readdir(dir)).filter((file) => !file.startsWith(".")).sort();
    return Object.fromEntries(
      await Promise.all(
        files.map(async (file) => [file, await readFile(path.join(dir, file), "utf8")] as const)
      )
    );
  });
}

describe("runShots", () => {
  it.live("refuses an upload of more than 50 images before taking any shot", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const record = newRecord();
      // 3 themes × 2 densities × 3 engines with diffs: 18 pairs of 3 images, 54 in all.
      const options = shotOptions([
        "matrix",
        "--route",
        "/components/button",
        "--target",
        "button:Save",
        "--themes",
        "internal-fkas-private,external-tkas-company,external-fkse-private",
        "--densities",
        "dense,comfortable",
        "--engines",
        "chromium,webkit,firefox",
        "--pr",
        "182",
      ]);
      const failure = yield* Effect.flip(runShots(options, root).pipe(Effect.provide(stubs(record, "run"))));
      assert.strictEqual(failure._tag, "TooManyAttachments");
      assert.include(failure.message, "54 images");
      assert.include(failure.message, "at most 50");
      assert.include(failure.message, "split the matrix across runs");
      assert.deepStrictEqual(record.captures, []);
    }).pipe(Effect.scoped)
  );

  it.effect("warns beside the printed command when the images are more than gh attaches", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const record = newRecord();
      // 30 pairs without diffs: 60 images.
      yield* runShots(shotOptions([...MATRIX, "--no-diff"]), root).pipe(Effect.provide(stubs(record, "run")));
      assert.strictEqual(record.captures.length, 2);
      const printed = (yield* TestConsole.logLines).map(String).join("\n");
      assert.include(printed, "gh pr edit attaches at most 50 files; this run has 60.");
    }).pipe(Effect.scoped)
  );

  it.live("uploads a run of exactly 50 images", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const record = newRecord();
      // 25 themes × 1 density × 1 engine without diffs: 25 pairs of 2 images, 50 in all. The
      // parser checks slug syntax only, so made-up brand codes do here.
      const themes = Array.from({ length: 25 }, (_, index) => `internal-b${"x".repeat(index + 1)}-private`);
      const options = shotOptions([
        "fifty",
        "--route",
        "/components/button",
        "--target",
        "button:Save",
        "--themes",
        themes.join(","),
        ...REMOTE,
        "--no-diff",
        "--pr",
        "182",
      ]);
      yield* runShots(options, root).pipe(Effect.provide(stubs(record, "run")));

      assert.strictEqual(record.ghEdits.length, 1);
      const [args = []] = record.ghEdits;
      assert.deepStrictEqual(args.slice(0, 5), ["pr", "edit", "182", "--body-file", "pr-body.md"]);
      assert.strictEqual(args.filter((arg) => arg === "--attach").length, 50);
    }).pipe(Effect.scoped)
  );

  it.live("keeps both runs' blocks when two runs upload to one pull request at once", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const pr = yield* sharedPullRequest("## Verification\n\n- Checks pass.\n", 2);
      const run = (name: string) =>
        runShots(
          shotOptions([
            name,
            "--route",
            "/components/button",
            "--target",
            "button:Save",
            ...REMOTE,
            "--no-diff",
            "--pr",
            "182",
          ]),
          root
        ).pipe(Effect.provide(stubs(newRecord(), name, { pr })));
      yield* Effect.all([run("first"), run("second")], { concurrency: 2 });

      const body = pr.body();
      assert.include(body, "<!-- pr-shots:first -->");
      assert.include(body, "<!-- /pr-shots:first -->");
      assert.include(body, "<!-- pr-shots:second -->");
      assert.include(body, "<!-- /pr-shots:second -->");
    }).pipe(Effect.scoped)
  );

  it.live(
    "fails at once with the manual instruction when the pull request's lock has an abandoned reclaim",
    () =>
      Effect.gen(function* () {
        const root = yield* checkout;
        // A run that died while reclaiming a stale lock leaves both behind.
        const lockFile = path.join(root, ".scratch/shots/.pr-182.lock");
        yield* Effect.promise(async () => {
          await mkdir(`${lockFile}.reclaim`, { recursive: true });
          await writeFile(lockFile, JSON.stringify({ pid: deadPid(), token: "crashed-upload" }));
        });
        const started = Date.now();
        const failure = yield* Effect.flip(
          runShots(
            shotOptions([
              "single",
              "--route",
              "/components/button",
              "--target",
              "button:Save",
              ...REMOTE,
              "--no-diff",
              "--pr",
              "182",
            ]),
            root
          ).pipe(Effect.provide(stubs(newRecord(), "single")))
        );
        assert.strictEqual(failure._tag, "LockNeedsRecovery");
        assert.include(failure.message, `delete ${lockFile}.reclaim`);
        // One wait for the mutex, not a retry loop.
        assert.isBelow(Date.now() - started, 10_000);
      }).pipe(Effect.scoped),
    { timeout: 30_000 }
  );

  it.live("gives up after two minutes while another run holds the pull request's lock", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      // Another live run is uploading to the same pull request.
      yield* holdLock(path.join(root, ".scratch/shots/.pr-182.lock"), "pull request #182");
      const record = newRecord();
      const stepped = yield* steppedClock();
      const upload = yield* Effect.forkChild(
        runShots(
          shotOptions([
            "waiting",
            "--route",
            "/components/button",
            "--target",
            "button:Save",
            ...REMOTE,
            "--no-diff",
            "--pr",
            "182",
          ]),
          root
        ).pipe(
          Effect.provide(stubs(record, "waiting")),
          Effect.provideService(Clock.Clock, stepped.clock),
          Effect.flip
        )
      );
      // The run is asleep whenever a sleep is posted, so moving time to that sleep's end can
      // never land in the middle of a lock attempt.
      let released = 0;
      for (;;) {
        const next = yield* Effect.raceFirst(
          Queue.take(stepped.sleeps).pipe(Effect.map(Option.some)),
          Fiber.await(upload).pipe(Effect.as(Option.none<PendingSleep>()))
        );
        if (Option.isNone(next)) {
          break;
        }
        released += 1;
        yield* stepped.release(next.value);
      }
      const failure = yield* Fiber.join(upload);

      assert.strictEqual(failure._tag, "UploadWaitTimedOut");
      assert.include(failure.message, "pull request #182");
      assert.include(failure.message, "2 minutes");
      // It gave up at the bound, by at most one 200 ms retry interval after it, having slept
      // between attempts the whole way.
      assert.isTrue(failure._tag === "UploadWaitTimedOut" && failure.waitedMillis >= 120_000);
      assert.isTrue(failure._tag === "UploadWaitTimedOut" && failure.waitedMillis <= 120_200);
      assert.strictEqual(released, 600);
      // It never got the lock, so it neither read nor edited the pull request.
      assert.deepStrictEqual(record.ghReads, []);
      assert.deepStrictEqual(record.ghEdits, []);
    }).pipe(Effect.scoped)
  );

  it.live("refuses a second run with the same name and leaves the first run's files alone", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const options = shotOptions([
        "same-name",
        "--route",
        "/components/button",
        "--target",
        "button:Save",
        ...REMOTE,
        "--no-diff",
      ]);
      // The first run stops inside its after capture, with its before shot written.
      const first = newRecord();
      const atAfter = yield* Deferred.make<void>();
      const resume = yield* Deferred.make<void>();
      const gate = (request: CaptureRequest) =>
        request.shots.some((shot) => shot.state === "after")
          ? Deferred.succeed(atAfter, undefined).pipe(Effect.andThen(Deferred.await(resume)))
          : Effect.void;
      const firstRun = yield* Effect.forkChild(
        runShots(options, root).pipe(Effect.provide(stubs(first, "first", { beforeCapture: gate })))
      );
      yield* Deferred.await(atAfter);
      const midway = yield* outputOf(root, "same-name");
      assert.deepStrictEqual(midway, {
        "before-default-theme-stage-density-light-chromium-1280x900-stage.png": "first",
      });

      const second = newRecord();
      const result = yield* Effect.result(
        runShots(options, root).pipe(Effect.provide(stubs(second, "second")))
      );
      assert.deepStrictEqual(second.captures, []);
      assert.strictEqual(result._tag, "Failure");
      assert.isTrue(
        result._tag === "Failure" &&
          result.failure._tag === "LockHeld" &&
          result.failure.message.includes(`Another pr-shots run (pid ${String(process.pid)})`)
      );
      assert.deepStrictEqual(yield* outputOf(root, "same-name"), midway);

      yield* Deferred.succeed(resume, undefined);
      yield* Fiber.join(firstRun);
      const done = yield* outputOf(root, "same-name");
      assert.strictEqual(
        done["after-default-theme-stage-density-light-chromium-1280x900-stage.png"],
        "first"
      );
    }).pipe(Effect.scoped)
  );

  it.live("captures nothing and clears nothing when the local docs server is taken", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const outDir = path.join(root, ".scratch/shots/phone-dial");
      yield* Effect.promise(async () => {
        await mkdir(outDir, { recursive: true });
        await writeFile(path.join(outDir, "before-earlier-run.png"), "earlier");
      });
      const record = newRecord();
      const taken = new DocsServerFailed({
        message: "Another pr-shots run (pid 1) is using the local docs server of this checkout.",
      });
      // Default sources: prod before, local after.
      const options = shotOptions([
        "phone-dial",
        "--route",
        "/components/phone-number-field",
        "--target",
        "textbox:Mobile",
      ]);
      const failure = yield* Effect.flip(
        runShots(options, root).pipe(Effect.provide(stubs(record, "run", { reserve: Effect.fail(taken) })))
      );
      assert.strictEqual(failure, taken);
      assert.deepStrictEqual(record.captures, []);
      assert.deepStrictEqual(yield* outputOf(root, "phone-dial"), { "before-earlier-run.png": "earlier" });
    }).pipe(Effect.scoped)
  );
});
