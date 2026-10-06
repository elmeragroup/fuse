/**
 * Serves the docs app from this checkout with `next dev` on a free port, as a scoped resource.
 *
 * The server writes to its own output directory, named through `DOCS_DIST_DIR` in
 * `apps/docs/next.config.ts`, so `docs#test:browser` can keep serving `apps/docs/.next` beside
 * it. It lives under `apps/docs/node_modules/.cache`, which git and the dev watcher ignore, and
 * persists between runs so Turbopack's cache keeps later starts fast.
 *
 * One residual write into `apps/docs/.next` remains. The `next dev` launcher learns the output
 * directory from its worker only when the worker reports the server ready. A SIGTERM before that
 * runs the launcher's shutdown handler with its fallback, `.next`, and the handler records a
 * session-stopped telemetry event and writes it to `.next/_events_<pid>.json`. The deferred
 * record skips the `NEXT_TELEMETRY_DISABLED` check, and no environment variable or config sets
 * the launcher's fallback (Next 16.3.6, `dist/cli/next-dev.js` and `dist/telemetry/storage.js`).
 * So an interrupt in the first seconds of a start can leave that one small file in `.next`. It
 * is not a build output, and `docs#test:browser` ignores it.
 */

import { Console, Context, Duration, Effect, Layer, Option, Schema, Stream } from "effect";
import type { Scope } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

import { holdLock } from "./file-lock.ts";

/** The local docs server did not come up. */
export class DocsServerFailed extends Schema.TaggedError<DocsServerFailed>()("DocsServerFailed", {
  message: Schema.String,
}) {}

/** The process a docs server runs, for a given port. */
export type ServerCommand = {
  /** The executable. */
  readonly executable: string;
  /** Its arguments. */
  readonly args: readonly string[];
  /** Variables added to the inherited environment. */
  readonly env: Readonly<Record<string, string>>;
};

/** How a `DocsServer` starts its process and which file the process rewrites. */
export type DocsServerConfig = {
  /** How messages name the server, such as `next dev`. */
  readonly name: string;
  /** The directory the process runs in. */
  readonly cwd: string;
  /** The command that serves on the given port. */
  readonly command: (port: number) => ServerCommand;
  /** A file the process rewrites while it runs, restored when the server stops. */
  readonly restoredFile: string;
  /** How long the first answer for the route may take. */
  readonly readyTimeout: Duration.Duration;
  /** How long the process group may take to exit after SIGTERM before it gets SIGKILL. */
  readonly forceKillAfter: Duration.Duration;
  /** The lock file that keeps a second run off the same checkout while this server runs. */
  readonly lockFile: string;
};

/** The checkout's local docs server, held by this run until its scope closes. */
export type ReservedDocsServer = {
  /**
   * Start the server and wait until it serves `route` without a server error. Closing the
   * scope stops the server's whole process group, then restores the rewritten file, whether the
   * run succeeded, failed or was interrupted.
   */
  readonly start: (route: string) => Effect.Effect<URL, DocsServerFailed, Scope.Scope>;
};

/** A local docs server that lives as long as the scope that started it. */
export class DocsServer extends Context.Service<
  DocsServer,
  {
    /**
     * Take the checkout's lock, so no other run uses or touches the local docs server, and
     * return the only handle that starts it. A run reserves before it takes any shot; closing
     * the scope frees the lock after the server has stopped and the file is restored. Fails
     * with the holder's pid when another run has it, and with `ServerStillRunning` when a run
     * that crashed left its server running.
     */
    readonly reserve: Effect.Effect<ReservedDocsServer, DocsServerFailed | ServerStillRunning, Scope.Scope>;
  }
>()("@elmeragroup/pr-shots/DocsServer") {
  /**
   * A server for `config`'s command, run through the platform's process service.
   *
   * @param config - The process to run, the file it rewrites and the lock it holds.
   * @returns A layer whose `start` runs that process.
   */
  static readonly layerWith = (config: DocsServerConfig) =>
    Layer.effect(
      DocsServer,
      Effect.gen(function* () {
        return makeDocsServer(config, yield* ChildProcessSpawner.ChildProcessSpawner);
      })
    );

  /** `next dev` for `apps/docs` in the checkout at `repoRoot`. */
  static readonly layerNextDev = (repoRoot: string) => DocsServer.layerWith(nextDevConfig(repoRoot));
}

/** The output directory, relative to `apps/docs`. */
const DIST_DIR = "node_modules/.cache/pr-shots-next";

/**
 * `next dev` for the checkout's docs app. `next dev` points `next-env.d.ts` at its own output
 * directory. The file is gitignored but the docs type-check reads it, so the server restores it.
 * The lock sits in the output directory, which every run on this checkout shares.
 */
function nextDevConfig(repoRoot: string): DocsServerConfig {
  const docsRoot = path.join(repoRoot, "apps/docs");
  return {
    name: "next dev",
    cwd: docsRoot,
    command: (port) => ({
      executable: process.execPath,
      args: [
        path.join(docsRoot, "node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      env: { DOCS_DIST_DIR: DIST_DIR, NEXT_TELEMETRY_DISABLED: "1" },
    }),
    restoredFile: path.join(docsRoot, "next-env.d.ts"),
    readyTimeout: Duration.minutes(3),
    forceKillAfter: Duration.seconds(5),
    lockFile: path.join(docsRoot, DIST_DIR, "pr-shots.lock"),
  };
}

function makeDocsServer(
  config: DocsServerConfig,
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]
): DocsServer["Service"] {
  // The lock is taken in the reserving scope, before the start's scope opens, so it is freed
  // after the start's finalizers: the process group is gone and the file is back before another
  // run can snapshot it.
  //
  // A run killed with SIGKILL skips its finalizers, so its detached server lives on and
  // next-env.d.ts stays rewritten. The crash record it left says which process group to look
  // for and what the file held. `recover` runs before a stale lock is reclaimed, and again once
  // the lock is held, for a record whose lock was deleted by hand.
  const recordFile = crashRecordFile(config);
  const reserve = holdLock(config.lockFile, "the local docs server of this checkout", {
    beforeReclaim: recover(recordFile),
  }).pipe(
    Effect.catchTags({
      LockHeld: (cause) => Effect.fail(new DocsServerFailed({ message: cause.message })),
      LockNeedsRecovery: (cause) => Effect.fail(new DocsServerFailed({ message: cause.message })),
      LockFailed: (cause) => Effect.fail(new DocsServerFailed({ message: cause.message })),
    }),
    Effect.andThen(recover(recordFile)),
    Effect.as<ReservedDocsServer>({ start: (route) => start(route) })
  );

  const start = Effect.fn("DocsServer.start")(function* (route: string) {
    // Finalizers run in reverse: the process group is gone before the file comes back. The
    // crash record goes only once the file is back; when it cannot come back, the record keeps
    // what it held, and the next run's `reserve` restores it from there.
    const before = yield* Effect.acquireRelease(snapshot(config.restoredFile), (taken) =>
      putBack(taken, recordFile).pipe(Effect.catch((failure) => Console.error(failure.message)))
    );
    const port = yield* freePort;
    const origin = new URL(`http://127.0.0.1:${String(port)}`);
    yield* Effect.annotateCurrentSpan({ port, route });

    const command = config.command(port);
    const handle = yield* spawner
      .spawn(
        ChildProcess.make(command.executable, [...command.args], {
          cwd: config.cwd,
          env: command.env,
          extendEnv: true,
          stdin: "ignore",
          forceKillAfter: config.forceKillAfter,
        })
      )
      .pipe(
        Effect.mapError(
          (cause) => new DocsServerFailed({ message: `${config.name} could not start: ${cause.message}` })
        )
      );

    // The spawner escalates to SIGKILL only while the launcher still runs: after a non-zero
    // exit it sends the group SIGTERM alone, after a signal exit nothing, so a worker that holds
    // the port can outlive it. This finalizer runs first and empties the whole group whatever
    // the launcher's state, so the file is restored and the lock freed only once it is gone.
    yield* Effect.addFinalizer(() => terminateGroup(handle.pid, config));
    yield* writeCrashRecord(recordFile, { group: handle.pid, snapshot: before });

    // Draining the output also keeps a full pipe from blocking the server.
    const output: string[] = [];
    yield* handle.all.pipe(
      Stream.decodeText(),
      Stream.runForEach((chunk) => Effect.sync(() => output.push(chunk))),
      Effect.ignore,
      Effect.forkScoped
    );
    const failed = (reason: string) => {
      const tail = output.join("").split("\n").slice(-30).join("\n");
      return new DocsServerFailed({ message: tail === "" ? reason : `${reason}\n${tail}` });
    };

    const progress = { last: "no response" };
    const exited = handle.exitCode.pipe(
      Effect.flatMap((code) =>
        Effect.fail(failed(`${config.name} exited with code ${String(code)} before serving ${route}`))
      ),
      Effect.catchTag("PlatformError", (cause) => Effect.fail(failed(cause.message)))
    );
    // The timeout covers the whole wait, so it also aborts a request that never completes.
    yield* Effect.raceFirst(pollRoute(new URL(route, origin), progress), exited).pipe(
      Effect.timeoutOrElse({
        duration: config.readyTimeout,
        orElse: () =>
          Effect.fail(
            failed(
              `${config.name} did not serve ${route} within ${Duration.format(config.readyTimeout)} (${progress.last})`
            )
          ),
      })
    );
    return origin;
  });
  return { reserve };
}

/** Polls the route until the server answers it with anything but a server error. */
const pollRoute = Effect.fn("DocsServer.pollRoute")(function* (url: URL, progress: { last: string }) {
  for (;;) {
    const status = yield* Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(url, { redirect: "manual", signal });
        await response.arrayBuffer();
        return response.status;
      },
      catch: () => "connection refused",
    }).pipe(Effect.result);
    // The first request after a start can fail while Turbopack is still compiling the route.
    if (status._tag === "Success" && status.success < 500) {
      return;
    }
    progress.last = status._tag === "Success" ? `status ${String(status.success)}` : status.failure;
    yield* Effect.sleep(Duration.millis(500));
  }
});

/** A crashed run left its local docs server running. */
export class ServerStillRunning extends Schema.TaggedError<ServerStillRunning>()("ServerStillRunning", {
  message: Schema.String,
  /** The server's process group. */
  group: Schema.Int,
}) {}

/**
 * What a running server leaves on disk for the next run, in case this one is killed: the
 * server's process group and what the rewritten file held before it started.
 */
const CrashRecord = Schema.Struct({
  group: Schema.Int,
  file: Schema.String,
  snapshot: Schema.Union([
    Schema.TaggedStruct("content", { content: Schema.String }),
    Schema.TaggedStruct("absent", {}),
  ]),
});

/** What a running server leaves on disk for the next run. */
type CrashRecord = typeof CrashRecord.Type;

const decodeCrashRecord = Schema.decodeUnknownOption(Schema.fromJsonString(CrashRecord));

/** The crash record sits beside the checkout lock. */
function crashRecordFile(config: DocsServerConfig): string {
  return `${config.lockFile}.server.json`;
}

function writeCrashRecord(
  recordFile: string,
  { group, snapshot: { file, content } }: { readonly group: number; readonly snapshot: Snapshot }
): Effect.Effect<void, DocsServerFailed> {
  const record: CrashRecord = {
    group,
    file,
    snapshot: content === null ? { _tag: "absent" } : { _tag: "content", content },
  };
  return Effect.tryPromise({
    try: () => writeFile(recordFile, JSON.stringify(record)),
    catch: (cause) => new DocsServerFailed({ message: `Could not write ${recordFile}: ${messageOf(cause)}` }),
  });
}

/**
 * Puts a rewritten file back as the snapshot holds it, and only then removes the crash record.
 * The normal release and crash recovery both use it, so the record never goes while the file is
 * still rewritten. A failure keeps the record and names the file.
 */
function putBack({ file, content }: Snapshot, recordFile: string): Effect.Effect<void, DocsServerFailed> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => (content === null ? rm(file, { force: true }) : writeFile(file, content)),
      catch: (cause) =>
        new DocsServerFailed({
          message: `Could not restore ${file}: ${messageOf(cause)}. ${recordFile} keeps what it held, and the next local run restores it from there once it can write the file.`,
        }),
    });
    yield* Effect.tryPromise({
      try: () => rm(recordFile, { force: true }),
      catch: (cause) =>
        new DocsServerFailed({
          message: `Restored ${file}, but could not remove ${recordFile}: ${messageOf(cause)}. Delete it by hand.`,
        }),
    });
  });
}

/**
 * Cleans up after a run that crashed while its server ran. Without a crash record there is
 * nothing to do. While the recorded group lives, it refuses and names the command that stops
 * it. Once the group is gone, it puts the rewritten file back as the record holds it and deletes
 * the record.
 */
function recover(recordFile: string): Effect.Effect<void, DocsServerFailed | ServerStillRunning> {
  return Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => readFile(recordFile, "utf8"),
      catch: (cause) => cause,
    }).pipe(
      Effect.map(Option.some),
      Effect.catch((cause) =>
        errorCode(cause) === "ENOENT"
          ? Effect.succeed(Option.none<string>())
          : Effect.fail(
              new DocsServerFailed({ message: `Could not read ${recordFile}: ${messageOf(cause)}` })
            )
      )
    );
    if (Option.isNone(text)) {
      return;
    }
    const record = decodeCrashRecord(text.value);
    if (Option.isNone(record)) {
      return yield* new DocsServerFailed({
        message: `${recordFile} is not a crash record pr-shots can read. Check that no local docs server from an earlier run is still running, delete the file, and run again.`,
      });
    }
    const { group, file, snapshot } = record.value;
    if (groupAlive(group)) {
      return yield* new ServerStillRunning({
        message: `A pr-shots run that crashed left its local docs server running as process group ${String(group)}. Stop it with \`kill -TERM -${String(group)}\`, then run again.`,
        group,
      });
    }
    yield* putBack({ file, content: snapshot._tag === "absent" ? null : snapshot.content }, recordFile);
  });
}

/** A file's content before the server touched it, or `null` when it did not exist. */
type Snapshot = { readonly file: string; readonly content: string | null };

/** Reads the file. Only `ENOENT` means absent; any other error stops the start. */
function snapshot(file: string): Effect.Effect<Snapshot, DocsServerFailed> {
  return Effect.tryPromise({
    try: () => readFile(file, "utf8"),
    catch: (cause) => cause,
  }).pipe(
    Effect.map((content): Snapshot => ({ file, content })),
    Effect.catch((cause) =>
      errorCode(cause) === "ENOENT"
        ? Effect.succeed<Snapshot>({ file, content: null })
        : Effect.fail(new DocsServerFailed({ message: `Could not read ${file}: ${messageOf(cause)}` }))
    )
  );
}

/** Asks the OS for a free loopback port. */
const freePort = Effect.callback<number, DocsServerFailed>((resume) => {
  const server = createServer();
  server.once("error", (cause) => {
    resume(
      Effect.fail(
        new DocsServerFailed({ message: `Could not find a free port on 127.0.0.1: ${cause.message}` })
      )
    );
  });
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => {
      resume(
        address instanceof Object
          ? Effect.succeed(address.port)
          : Effect.fail(new DocsServerFailed({ message: "A TCP server on 127.0.0.1 reported no port" }))
      );
    });
  });
  return Effect.sync(() => {
    server.close();
  });
});

/** How long a group may take to go after SIGKILL before the run reports it and moves on. */
const KILLED_GROUP_WAIT = Duration.seconds(5);

/**
 * Sends SIGTERM to the process group, waits up to `forceKillAfter` for it to empty, sends
 * SIGKILL to whatever is left, and waits until the group is empty.
 */
const terminateGroup = Effect.fn("DocsServer.terminateGroup")(function* (
  group: number,
  { name, forceKillAfter }: DocsServerConfig
) {
  signalGroup(group, "SIGTERM");
  if (yield* groupEmptied(group, forceKillAfter)) {
    return;
  }
  signalGroup(group, "SIGKILL");
  if (!(yield* groupEmptied(group, KILLED_GROUP_WAIT))) {
    yield* Console.error(`${name}'s process group ${String(group)} survived SIGKILL; stop it by hand.`);
  }
});

/** Signals every process in the group; a group that is already empty is fine. */
function signalGroup(group: number, signal: "SIGTERM" | "SIGKILL"): void {
  try {
    process.kill(-group, signal);
  } catch {
    // ESRCH: nothing left to signal.
  }
}

/** Polls until the group has no process left, or the wait runs out. Returns whether it emptied. */
function groupEmptied(group: number, wait: Duration.Duration) {
  return Effect.gen(function* () {
    const deadline = Date.now() + Duration.toMillis(wait);
    while (groupAlive(group)) {
      if (Date.now() >= deadline) {
        return false;
      }
      yield* Effect.sleep(Duration.millis(20));
    }
    return true;
  });
}

/** Whether any process of the group exists; `EPERM` means one exists under another user. */
function groupAlive(group: number): boolean {
  try {
    process.kill(-group, 0);
    return true;
  } catch (cause) {
    return errorCode(cause) === "EPERM";
  }
}

/** A Node system error's `code`, such as `ENOENT`, or `undefined` for anything else. */
function errorCode(cause: unknown): string | undefined {
  return cause instanceof Error && "code" in cause ? String(cause.code) : undefined;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
