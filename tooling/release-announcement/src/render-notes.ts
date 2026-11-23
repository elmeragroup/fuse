/**
 * Reads a version's notes from a changelog and renders them, as a process of its own: the
 * announcement's notes renderer (`isolated-notes.ts`) starts it, hands it a request as JSON on
 * standard input, and reads the notes as JSON from standard output. Running apart lets the
 * announcement end a parse that runs too long, which a synchronous parse in its own process would
 * not let it do.
 *
 * Usage: node render-notes.ts < request.json
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";

import { versionNotes } from "./release-notes.ts";
import { RenderedNotes, RenderRequest } from "./render-protocol.ts";

const main = Effect.gen(function* () {
  const input = yield* (yield* Stdio.Stdio).stdin.pipe(Stream.decodeText(), Stream.mkString);
  const request = yield* Schema.decodeEffect(RenderRequest)(input);
  const notes = versionNotes(request.changelog, request.version);
  yield* Console.log(yield* Schema.encodeEffect(RenderedNotes)(notes));
});

NodeRuntime.runMain(main.pipe(Effect.provide(NodeServices.layer)));
