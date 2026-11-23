/**
 * An exclusive lock file that serializes edits to one deck, so two agents editing the order at once
 * cannot lose either change.
 *
 * The lock file holds its owner's record, `{"pid":…,"token":…}`, and is never visible without it:
 * an edit writes the record to a temporary file and hard-links that into place, and the link fails
 * when the lock already exists. A lock whose owner is no longer running is stale. Removing it is
 * the only dangerous step, because another edit may have reclaimed it and created a fresh lock
 * under the same name in the meantime. So a reclaim runs under a second, `mkdir`-based mutex, and
 * removes the lock only if it still holds the exact stale record the edit judged.
 *
 * This follows `tooling/pr-shots/src/file-lock.ts`, through the `FileSystem` service, and waits a
 * few seconds for a live holder before it gives up, since deck edits take milliseconds.
 */

import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import { randomUUID } from "node:crypto";
import path from "node:path";

/** Another edit held the lock for longer than this one waits. */
export class LockHeld extends Schema.TaggedError<LockHeld>()("LockHeld", {
  message: Schema.String,
  hint: Schema.String,
  file: Schema.String,
}) {}

/**
 * The lock is in a state no edit clears by waiting: an owner record that is incomplete, or a
 * reclaim mutex its reclaimer left behind. The hint says what to delete by hand.
 */
export class LockNeedsRecovery extends Schema.TaggedError<LockNeedsRecovery>()("LockNeedsRecovery", {
  message: Schema.String,
  hint: Schema.String,
  file: Schema.String,
}) {}

/** The lock file could not be created, read or removed. */
export class LockFailed extends Schema.TaggedError<LockFailed>()("LockFailed", {
  message: Schema.String,
  file: Schema.String,
}) {}

/** Who holds a lock. The token tells two records of the same pid apart. */
const OwnerRecord = Schema.Struct({
  pid: Schema.Int,
  token: Schema.NonEmptyString,
});

const decodeOwner = Schema.decodeUnknownOption(Schema.fromJsonString(OwnerRecord));
const encodeOwner = Schema.encodeEffect(Schema.fromJsonString(OwnerRecord));

/** A lock this edit holds. */
type Held = { readonly file: string; readonly token: string };

/** How many times an edit retries when the lock vanishes or is reclaimed under it. */
const ATTEMPTS = 3;

/** How long an edit waits for another edit's reclaim to finish. */
const RECLAIM_WAIT = Duration.seconds(2);

/** How often an edit tries again while a live edit holds the lock. */
const HELD_RETRY = Schedule.spaced(Duration.millis(25));

/** How many times it tries again, about five seconds in all. */
const HELD_RETRIES = 200;

/**
 * Hold `file` as an exclusive lock until the scope closes. A stale lock is taken over; a live
 * holder is waited for, up to about five seconds.
 *
 * @param file - The lock file.
 * @returns An effect that holds the lock for its scope.
 */
export function holdLock(
  file: string
): Effect.Effect<void, LockHeld | LockNeedsRecovery | LockFailed, FileSystem.FileSystem | Scope.Scope> {
  return Effect.asVoid(
    Effect.acquireRelease(
      lock(file).pipe(
        Effect.retry({
          schedule: HELD_RETRY,
          times: HELD_RETRIES,
          while: (error) => error._tag === "LockHeld",
        })
      ),
      unlock
    )
  );
}

function lock(file: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const failedWith = (reason: string) =>
      new LockFailed({ message: `Could not lock ${file}: ${reason}`, file });
    const failed = (cause: PlatformError.PlatformError) => failedWith(cause.message);
    const owner = { pid: process.pid, token: randomUUID() };
    const record = yield* encodeOwner(owner).pipe(Effect.mapError((cause) => failedWith(cause.message)));

    yield* fs.makeDirectory(path.dirname(file), { recursive: true }).pipe(Effect.mapError(failed));
    for (let round = 0; round < ATTEMPTS; round += 1) {
      if (yield* create(fs, file, record, owner.token).pipe(Effect.mapError(failed))) {
        return { file, token: owner.token } satisfies Held;
      }
      const seen = yield* readRecord(fs, file).pipe(Effect.mapError(failed));
      if (Option.isNone(seen)) {
        // The holder released it between the link and the read.
        continue;
      }
      const holder = decodeOwner(seen.value);
      if (Option.isNone(holder)) {
        return yield* new LockNeedsRecovery({
          message: `${file} has no complete owner record, so another edit may be taking it right now.`,
          hint: `If no fuse-deck command is running on this deck, delete ${file} and run again.`,
          file,
        });
      }
      if (isRunning(holder.value.pid)) {
        return yield* new LockHeld({
          message: `Another fuse-deck command (pid ${String(holder.value.pid)}) is editing this deck.`,
          hint: "Run the command again when it has finished.",
          file,
        });
      }
      yield* reclaim(fs, file, seen.value, failed);
    }
    return yield* failedWith("other edits kept taking the lock while this one tried");
  }).pipe(Effect.withSpan("FileLock.lock"));
}

/**
 * Writes the record to a temporary file and links it into place, so the lock appears with its
 * owner record. Returns whether this edit created the lock.
 */
function create(fs: FileSystem.FileSystem, file: string, record: string, token: string) {
  const temporary = `${file}.${token}.tmp`;
  return Effect.gen(function* () {
    yield* fs.writeFileString(temporary, record);
    const linked = yield* fs.link(temporary, file).pipe(
      Effect.as(true),
      Effect.catchIf(isAlreadyExists, () => Effect.succeed(false))
    );
    yield* fs.remove(temporary, { force: true });
    return linked;
  });
}

/**
 * Removes a stale lock under the reclaim mutex, but only if the file still holds `seen`, the stale
 * record this edit judged. Anything else at that path is a lock another edit created, and stays.
 */
function reclaim(
  fs: FileSystem.FileSystem,
  file: string,
  seen: string,
  failed: (cause: PlatformError.PlatformError) => LockFailed
) {
  const mutex = `${file}.reclaim`;
  const takeMutex = fs.makeDirectory(mutex).pipe(
    Effect.as(true),
    Effect.catchIf(isAlreadyExists, () => Effect.succeed(false)),
    Effect.mapError(failed)
  );
  return Effect.gen(function* () {
    const deadline = (yield* Clock.currentTimeMillis) + Duration.toMillis(RECLAIM_WAIT);
    while (!(yield* takeMutex)) {
      if ((yield* Clock.currentTimeMillis) >= deadline) {
        return yield* new LockNeedsRecovery({
          message: `Another edit has been reclaiming ${file} for longer than a reclaim takes, so it may have died while it did.`,
          hint: `If no fuse-deck command is running on this deck, delete ${mutex} and run again.`,
          file,
        });
      }
      yield* Effect.sleep(Duration.millis(20));
    }
    yield* Effect.ensuring(
      Effect.gen(function* () {
        const current = yield* readRecord(fs, file);
        if (Option.isSome(current) && current.value === seen) {
          yield* fs.remove(file, { force: true });
        }
      }).pipe(Effect.mapError(failed)),
      fs.remove(mutex, { recursive: true, force: true }).pipe(Effect.ignore)
    );
  });
}

/** Removes the lock if it still holds this edit's record. */
function unlock({ file, token }: Held): Effect.Effect<void, never, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const record = yield* readRecord(fs, file);
    const holder = Option.flatMap(record, decodeOwner);
    if (Option.isSome(holder) && holder.value.token === token) {
      yield* fs.remove(file, { force: true });
    }
  }).pipe(Effect.ignore);
}

/** The lock file's text, or none when it does not exist. */
function readRecord(fs: FileSystem.FileSystem, file: string) {
  return fs.readFileString(file).pipe(
    Effect.asSome,
    Effect.catchIf(isNotFound, () => Effect.succeed(Option.none<string>()))
  );
}

/** Whether a process with this pid exists; `EPERM` means it exists under another user. */
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return cause instanceof Error && "code" in cause && cause.code === "EPERM";
  }
}

function isAlreadyExists(error: PlatformError.PlatformError): boolean {
  return error.reason._tag === "AlreadyExists";
}

function isNotFound(error: PlatformError.PlatformError): boolean {
  return error.reason._tag === "NotFound";
}
