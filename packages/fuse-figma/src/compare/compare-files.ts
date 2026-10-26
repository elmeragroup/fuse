/**
 * The files the comparison reads and writes, through the `FileSystem` service: a font, a Fuse build
 * output, the snapshot, the report or a cell's pictures. A failure names what the run tried and the
 * path, then gives the system's own words, as Node's file calls state them.
 */

import { Effect, FileSystem } from "effect";
import type { PlatformError } from "effect";

/** A file the comparison reads or writes could not be read or written. */
export class CompareFileFailed extends Error {
  readonly _tag = "CompareFileFailed" as const;
}

/**
 * The system's words for a file failure: the message of the error Node threw, where there is one.
 *
 * @param error - The file system's error.
 * @returns The message.
 */
function systemMessage(error: PlatformError.PlatformError): string {
  const { reason } = error;
  return reason._tag !== "BadArgument" && reason.cause instanceof Error
    ? reason.cause.message
    : error.message;
}

/**
 * Report a file failure as `Could not <action> <path>: <the system's words>`.
 *
 * @param action - What the run tried, such as `read` or `write`.
 * @param path - The file or directory.
 * @returns A function that turns the file system's error into the comparison's.
 */
export function fileFailure(
  action: string,
  path: string
): (error: PlatformError.PlatformError) => CompareFileFailed {
  return (error) =>
    new CompareFileFailed(`Could not ${action} ${path}: ${systemMessage(error)}`, { cause: error });
}

/**
 * Write a text file, such as the report or the self-check's snapshot.
 *
 * @param path - The file.
 * @param text - Its text.
 * @returns The Effect that writes it, failing with `CompareFileFailed`.
 */
export const writeText = Effect.fnUntraced(function* (path: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(path, text).pipe(Effect.mapError(fileFailure("write", path)));
});

/**
 * Write a binary file, such as a cell's picture.
 *
 * @param path - The file.
 * @param bytes - Its bytes.
 * @returns The Effect that writes it, failing with `CompareFileFailed`.
 */
export const writeBytes = Effect.fnUntraced(function* (path: string, bytes: Uint8Array) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFile(path, bytes).pipe(Effect.mapError(fileFailure("write", path)));
});

/**
 * Read a text file, such as a font's CSS or the snapshot.
 *
 * @param path - The file.
 * @returns The Effect that reads its text, failing with `CompareFileFailed`.
 */
export const readText = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path).pipe(Effect.mapError(fileFailure("read", path)));
});

/**
 * Create a directory and any parent it lacks, such as the report's.
 *
 * @param path - The directory.
 * @returns The Effect that creates it, failing with `CompareFileFailed`.
 */
export const makeDirectory = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(path, { recursive: true }).pipe(Effect.mapError(fileFailure("create", path)));
});
