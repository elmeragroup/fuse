/**
 * The package's release history read from the checkout's git: the changelog, the package version
 * and the subject of a release commit. git runs in the working directory, which the workflow
 * checks out with its full history so a retried record's commit is present.
 */

import { Duration, Effect, Fiber, Layer, Option, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { CHANGELOG_PATH } from "./announcement.ts";
import { Changelog } from "./changelog-section.ts";
import { ChangelogSource, GitReadFailed } from "./release-announcement.ts";
import { StableVersion } from "./release-record.ts";
import type { CommitSha } from "./release-record.ts";

/** The manifest whose version a version commit publishes as a stable release. */
const MANIFEST_PATH = "packages/fuse/package.json";

const Manifest = Schema.fromJsonString(Schema.Struct({ version: StableVersion }));

/** What one git run wrote: its output, read in full or cut at a byte limit. */
type GitOutput =
  | { readonly _tag: "Whole"; readonly text: string }
  | { readonly _tag: "Prefix"; readonly text: string };

/** Reads the release history with the `git` on `PATH`. */
export const layer = Layer.effect(
  ChangelogSource,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    /**
     * Runs git and reads at most `limit` bytes of its output. Output past the limit is not read:
     * closing the scope kills git, so a changelog of any size costs at most `limit` bytes of
     * memory. A run whose output fits must exit 0.
     */
    const git = (read: string, args: readonly string[], limit: number) =>
      Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make("git", args, { stdin: "ignore", forceKillAfter: Duration.seconds(2) })
          );
          const stderr = yield* handle.stderr.pipe(Stream.decodeText(), Stream.mkString, Effect.forkScoped);
          // Each chunk with the bytes read up to its end. The read stops after the chunk that
          // passes the limit, so the scope's end kills git rather than read the rest.
          const chunks = yield* handle.stdout.pipe(
            Stream.mapAccum(
              () => 0,
              (total, chunk) => [total + chunk.length, [{ chunk, end: total + chunk.length }]] as const
            ),
            Stream.takeUntil(({ end }) => end > limit),
            Stream.runCollect
          );
          const size = chunks.at(-1)?.end ?? 0;
          // UTF-8, with a replacement character for a sequence the limit cut in two.
          const text = yield* Stream.fromIterable(
            chunks.map(({ chunk, end }) =>
              end > limit ? chunk.subarray(0, chunk.length - (end - limit)) : chunk
            )
          ).pipe(Stream.decodeText(), Stream.mkString);
          if (size > limit) return { _tag: "Prefix", text } satisfies GitOutput;
          const exitCode = yield* handle.exitCode;
          if (exitCode !== 0) {
            const message = (yield* Fiber.join(stderr)).trim();
            return yield* new GitReadFailed({
              message: `git ${args.join(" ")} failed${message === "" ? ` (exit ${String(exitCode)})` : `: ${message}`}`,
              read,
            });
          }
          return { _tag: "Whole", text } satisfies GitOutput;
        })
      ).pipe(
        Effect.catchTag("PlatformError", (error) =>
          Effect.fail(
            new GitReadFailed({ message: `git ${args.join(" ")} could not run: ${error.message}`, read })
          )
        )
      );

    /** A short output, such as a subject or a manifest, read in full. */
    const text = Effect.fnUntraced(function* (read: string, args: readonly string[]) {
      const output = yield* git(read, args, SHORT_OUTPUT_LIMIT);
      if (output._tag === "Prefix") {
        return yield* new GitReadFailed({
          message: `git ${args.join(" ")} wrote more than expected`,
          read,
        });
      }
      return output.text;
    });

    const changelog = Effect.fn("GitChangelog.changelog")(function* (commit: CommitSha, limit: number) {
      yield* Effect.annotateCurrentSpan({ commit });
      const listed = yield* text(commit, ["ls-tree", "--name-only", commit, "--", CHANGELOG_PATH]);
      if (listed.trim() === "") return Option.none();
      const output = yield* git(commit, ["show", `${commit}:${CHANGELOG_PATH}`], limit);
      const read = output.text;
      return Option.some(
        output._tag === "Whole" ? Changelog.Whole({ text: read }) : Changelog.Prefix({ text: read })
      );
    });

    const subject = Effect.fn("GitChangelog.subject")(function* (commit: CommitSha) {
      yield* Effect.annotateCurrentSpan({ commit });
      return (yield* text(commit, ["log", "-1", "--format=%s", commit])).trim();
    });

    const packageVersion = Effect.fn("GitChangelog.packageVersion")(function* (commit: CommitSha) {
      yield* Effect.annotateCurrentSpan({ commit });
      const manifest = yield* text(commit, ["show", `${commit}:${MANIFEST_PATH}`]);
      const decoded = yield* Schema.decodeUnknownEffect(Manifest)(manifest).pipe(
        Effect.mapError(
          (error) =>
            new GitReadFailed({
              message: `${MANIFEST_PATH} at ${commit} names no stable version: ${error.message.replaceAll(/\s*\n\s*/gu, " ")}`,
              read: commit,
            })
        )
      );
      return decoded.version;
    });

    return ChangelogSource.of({ changelog, subject, packageVersion });
  })
);

/** Subjects and manifests are a few hundred bytes; a megabyte means git read something else. */
const SHORT_OUTPUT_LIMIT = 1024 * 1024;
