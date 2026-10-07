/**
 * An exclusive lock file that keeps a second pr-shots run off a resource while one run uses it.
 *
 * The lock file holds its owner's record, `{"pid":…,"token":…}`, and is never visible without
 * it: a run writes the record to a temporary file and hard-links that into place, and the link
 * fails when the lock already exists. A lock whose owner is no longer running is stale. Removing
 * it is the only dangerous step, because another run may have reclaimed it and created a fresh
 * lock under the same name in the meantime. So a reclaim runs under a second, `mkdir`-based
 * mutex, and removes the lock only if it still holds the exact stale record the run judged.
 * While the stale file is in place nobody can create a fresh lock, and other reclaimers wait for
 * the mutex, so the recheck cannot go out of date before the removal.
 *
 * Checked alternative: `proper-lockfile` judges staleness by mtime and needs a heartbeat timer,
 * so a crashed run blocks the next one for the whole staleness window. The owner's pid tells at
 * once whether a lock is stale.
 */

import { Clock, Duration, Effect, Option, Schema } from "effect";
import type { Scope } from "effect";
import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** A live run holds the lock. Waiting for it to finish clears this. */
export class LockHeld extends Schema.TaggedError<LockHeld>()("LockHeld", {
  message: Schema.String,
  /** The lock file. */
  file: Schema.String,
}) {}

/**
 * The lock is in a state no run clears by waiting: an owner record that is incomplete, or a
 * reclaim mutex its reclaimer left behind. The message says what to delete by hand.
 */
export class LockNeedsRecovery extends Schema.TaggedError<LockNeedsRecovery>()("LockNeedsRecovery", {
  message: Schema.String,
  /** The lock file. */
  file: Schema.String,
}) {}

/** The lock file could not be created, read or removed. */
export class LockFailed extends Schema.TaggedError<LockFailed>()("LockFailed", {
  message: Schema.String,
  /** The lock file. */
  file: Schema.String,
}) {}

/**
 * Hold `file` as an exclusive lock until the scope closes. A lock whose owner is no longer
 * running is stale and is taken over; a live one, or one without a complete owner record, fails
 * with `LockHeld`.
 *
 * @param file - The lock file.
 * @param resource - What the lock guards, as the message names it, such as `the local docs server of this checkout`.
 */
export function holdLock<E = never>(
  file: string,
  resource: string,
  options: HoldLockOptions<E> = {}
): Effect.Effect<void, LockHeld | LockNeedsRecovery | LockFailed | E, Scope.Scope> {
  return Effect.asVoid(
    Effect.acquireRelease(lock(file, resource, options.beforeReclaim ?? Effect.void), unlock)
  );
}

/** What a lock's owner does around taking it. */
export type HoldLockOptions<E> = {
  /**
   * Runs before a stale lock is removed, under the reclaim mutex, once the run has confirmed the
   * lock still holds the stale record. A failure leaves the stale lock in place and fails the
   * run, so the owner can clean up what the crashed run left, or refuse.
   */
  readonly beforeReclaim?: Effect.Effect<void, E>;
};

/** Who holds a lock. The token tells two records of the same pid apart. */
const OwnerRecord = Schema.Struct({
  pid: Schema.Int,
  token: Schema.NonEmptyString,
});

/** Who holds a lock. */
type OwnerRecord = typeof OwnerRecord.Type;

const decodeOwner = Schema.decodeUnknownOption(Schema.fromJsonString(OwnerRecord));

/** A lock this run holds. */
type Held = { readonly file: string; readonly token: string };

/** How many times a run retries when the lock vanishes or is reclaimed under it. */
const ATTEMPTS = 3;

/** How long a run waits for another run's reclaim to finish. */
const RECLAIM_WAIT = Duration.seconds(2);

function lock<E>(file: string, resource: string, beforeReclaim: Effect.Effect<void, E>) {
  return Effect.gen(function* () {
    const owner: OwnerRecord = { pid: process.pid, token: randomUUID() };
    const record = JSON.stringify(owner);
    const failed = (cause: unknown) =>
      new LockFailed({ message: `Could not lock ${file}: ${messageOf(cause)}`, file });

    yield* attempt(() => mkdir(path.dirname(file), { recursive: true }), failed);
    for (let round = 0; round < ATTEMPTS; round += 1) {
      if (yield* create(file, record, owner.token, failed)) {
        return { file, token: owner.token } satisfies Held;
      }
      const seen = yield* readRecord(file, failed);
      if (Option.isNone(seen)) {
        // The holder released it between the link and the read.
        continue;
      }
      const holder = decodeOwner(seen.value);
      if (Option.isNone(holder)) {
        return yield* new LockNeedsRecovery({
          message: `${file} has no complete owner record, so another run may be taking it right now. If no pr-shots run is active, delete ${file} and run again.`,
          file,
        });
      }
      if (isRunning(holder.value.pid)) {
        return yield* new LockHeld({
          message: `Another pr-shots run (pid ${String(holder.value.pid)}) is using ${resource}. Wait for it to finish or stop it, then run again.`,
          file,
        });
      }
      yield* reclaim(file, seen.value, failed, beforeReclaim);
    }
    return yield* failed("other runs kept taking the lock while this one tried");
  }).pipe(Effect.withSpan("FileLock.lock"));
}

/**
 * Writes the record to a temporary file and links it into place, so the lock appears with its
 * owner record. Returns whether this run created the lock.
 */
function create(file: string, record: string, token: string, failed: (cause: unknown) => LockFailed) {
  const temporary = `${file}.${token}.tmp`;
  return Effect.gen(function* () {
    yield* attempt(() => writeFile(temporary, record), failed);
    const linked = yield* attempt(
      () =>
        link(temporary, file).then(
          () => true,
          (cause: unknown) => {
            if (errorCode(cause) === "EEXIST") {
              return false;
            }
            throw cause;
          }
        ),
      failed
    );
    yield* attempt(() => rm(temporary, { force: true }), failed);
    return linked;
  });
}

/**
 * Removes a stale lock under the reclaim mutex, but only if the file still holds `seen`, the
 * stale record this run judged. Anything else at that path is a lock another run created, and
 * stays.
 */
function reclaim<E>(
  file: string,
  seen: string,
  failed: (cause: unknown) => LockFailed,
  beforeReclaim: Effect.Effect<void, E>
) {
  const mutex = `${file}.reclaim`;
  const takeMutex = attempt(
    () =>
      mkdir(mutex).then(
        () => true,
        (cause: unknown) => {
          if (errorCode(cause) === "EEXIST") {
            return false;
          }
          throw cause;
        }
      ),
    failed
  );
  return Effect.gen(function* () {
    const deadline = (yield* Clock.currentTimeMillis) + Duration.toMillis(RECLAIM_WAIT);
    while (!(yield* takeMutex)) {
      if ((yield* Clock.currentTimeMillis) >= deadline) {
        return yield* new LockNeedsRecovery({
          message: `Another run has been reclaiming ${file} for longer than a reclaim takes, so it may have died while it did. If no pr-shots run is active, delete ${mutex} and run again.`,
          file,
        });
      }
      yield* Effect.sleep(Duration.millis(20));
    }
    yield* Effect.ensuring(
      Effect.gen(function* () {
        const current = yield* readRecord(file, failed);
        if (Option.isSome(current) && current.value === seen) {
          yield* beforeReclaim;
          yield* attempt(() => rm(file, { force: true }), failed);
        }
      }),
      Effect.promise(() => rmdir(mutex).catch(() => undefined))
    );
  });
}

/** Removes the lock if it still holds this run's record. */
function unlock({ file, token }: Held): Effect.Effect<void> {
  return Effect.promise(async () => {
    const record = await readFile(file, "utf8").catch(() => "");
    const holder = decodeOwner(record);
    if (Option.isSome(holder) && holder.value.token === token) {
      await rm(file, { force: true });
    }
  });
}

/** The lock file's text, or none when it does not exist. */
function readRecord(file: string, failed: (cause: unknown) => LockFailed) {
  return attempt(
    () =>
      readFile(file, "utf8").then(Option.some, (cause: unknown) => {
        if (errorCode(cause) === "ENOENT") {
          return Option.none<string>();
        }
        throw cause;
      }),
    failed
  );
}

function attempt<A>(run: () => Promise<A>, failed: (cause: unknown) => LockFailed) {
  return Effect.tryPromise({ try: run, catch: failed });
}

/** Whether a process with this pid exists; `EPERM` means it exists under another user. */
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
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
