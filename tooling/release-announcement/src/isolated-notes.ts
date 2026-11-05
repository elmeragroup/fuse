/**
 * The notes renderer, run in a child process under a time limit. micromark's parse time grows
 * faster than its input on deeply nested Markdown: some changelogs well inside the read limit would
 * parse for hours. A parse is synchronous, so it cannot be interrupted inside the announcement's
 * own process; in a child process it can be ended. A child that has not answered within
 * `NOTES_TIME_LIMIT` (10 seconds unless set) is stopped, and the notes are `Unreadable`, which the
 * announcement links instead. Any other failure of the child is `Unreadable` too.
 *
 * The child is started in the announcement's process group rather than one of its own, so ending
 * the announcement's group, as a cancelled job does, ends the child with it. It gets an empty
 * environment, so none of the step's secrets reach the code that parses the changelog, and at
 * most `ANSWER_LIMIT` bytes of what it writes are read.
 */

import { Config, Duration, Effect, Layer, Option, Path, Schema, Stream } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import type { Changelog } from "./changelog-section.ts";
import { NotesRenderer } from "./release-announcement.ts";
import type { UnreadableCause, VersionNotes } from "./release-notes.ts";
import type { StableVersion } from "./release-record.ts";
import { RenderedNotes, RenderRequest } from "./render-protocol.ts";

/**
 * How long reading and rendering a version's notes may take, the child's start included. Measured
 * on this repository's machine: the 172 KB 0.1.0 section takes 0.07 s to parse and render, 0.4 s
 * with the child's start; hostile shapes inside the read limit take from 7 s (16 KiB of `- `) to
 * well over a minute (nested `**`, nested images, 512 KiB of `> `). Ten seconds leaves a slow runner
 * twenty times the real changelog's time and stops the rest.
 */
const timeLimit = Config.Duration("NOTES_TIME_LIMIT").pipe(Config.withDefault(Duration.seconds(10)));

/**
 * The most an answer may be, in bytes: four sections of 3000 characters as JSON, escapes and all,
 * fit several times over. Exactly this many is read; a child that writes more is not read further.
 */
const ANSWER_LIMIT = 64 * 1024;

/** How the child's run ended. */
type ChildRun =
  | { readonly _tag: "Answered"; readonly stdout: string; readonly exitCode: number }
  | { readonly _tag: "Oversized" };

/** The run of a child that wrote more than `ANSWER_LIMIT` bytes. */
const OVERSIZED = { _tag: "Oversized" } as const satisfies ChildRun;

/** Renders notes in a child process of `node` running `render-notes.ts`. */
export const layer = Layer.effect(
  NotesRenderer,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const path = yield* Path.Path;
    const limit = yield* timeLimit;
    const entry = yield* path.fromFileUrl(new URL("./render-notes.ts", import.meta.url));

    /**
     * Runs the child to its end: what it wrote and how it exited, or that it wrote more than an
     * answer can hold, in which case the rest is not read and the child is killed.
     */
    const run = (request: string) =>
      Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make(process.execPath, [entry], {
              stdin: Stream.make(request).pipe(Stream.encodeText),
              // The child needs nothing from the step's environment, which holds the Slack token.
              env: {},
              extendEnv: false,
              // A parse cannot act on SIGTERM, so the child is killed a second after it.
              forceKillAfter: Duration.seconds(1),
              detached: false,
            })
          );
          yield* handle.stderr.pipe(Stream.runDrain, Effect.forkScoped);
          return yield* handle.stdout.pipe(
            // The chunk that would take the answer past the limit is not read, and the read fails;
            // leaving the scope then kills the child.
            Stream.limitBytes<PlatformError | typeof OVERSIZED, never>(ANSWER_LIMIT, () =>
              Stream.fail(OVERSIZED)
            ),
            Stream.decodeText(),
            Stream.mkString,
            Effect.flatMap((stdout) =>
              Effect.map(handle.exitCode, (exitCode): ChildRun => ({ _tag: "Answered", stdout, exitCode }))
            ),
            Effect.catchTag("Oversized", (oversized) => Effect.succeed<ChildRun>(oversized))
          );
        })
      );

    const render = Effect.fn("IsolatedNotes.render")(
      function* (changelog: Changelog, version: StableVersion) {
        yield* Effect.annotateCurrentSpan({ version });
        const unreadable = (cause: UnreadableCause): VersionNotes => ({ _tag: "Unreadable", cause });
        const request = yield* Schema.encodeEffect(RenderRequest)({ version, changelog });
        const finished = yield* run(request).pipe(Effect.timeoutOption(limit));
        if (Option.isNone(finished)) return unreadable("over-budget");
        if (finished.value._tag === "Oversized") return unreadable("answer-too-large");
        if (finished.value.exitCode !== 0) return unreadable("renderer-failed");
        // The schema bounds the notes too: at most four sections, each 1 to 3000 characters.
        return yield* Schema.decodeUnknownEffect(RenderedNotes)(finished.value.stdout.trim());
      },
      Effect.catch(() => Effect.succeed<VersionNotes>({ _tag: "Unreadable", cause: "renderer-failed" }))
    );

    return NotesRenderer.of({ render });
  })
);
