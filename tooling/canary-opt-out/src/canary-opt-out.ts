/**
 * Decides whether a push to `main` publishes a canary, for the merge workflow's `canary-opt-out`
 * job (`canary-decision.ts` holds the rule). It writes `skip=true` or `skip=false` to
 * GITHUB_OUTPUT and explains each pushed commit's part on stderr. A failed lookup, an answer that
 * is not a PR list or an unreadable payload writes nothing and fails the step, which skips
 * publication visibly instead of guessing.
 *
 * The commits come from the push payload rather than `before..after`: the payload names exactly
 * what this push landed, needs no history in the checkout, and stays meaningful after a force
 * push, whose `before` may no longer be an ancestor.
 *
 * Usage: GITHUB_EVENT_PATH=<push payload> GITHUB_REPOSITORY=<owner/name> GH_TOKEN=<token>
 *   GITHUB_OUTPUT=<file> node canary-opt-out.ts
 */

import { NodeHttpClient, NodeServices } from "@effect/platform-node";
import { Config, Console, Effect, FileSystem, Layer, Schema } from "effect";

import { CommitSha, decide } from "./canary-decision.ts";
import { runStep, setSkipOutput } from "./github-actions.ts";
import * as GitHubPulls from "./github-pulls.ts";

/** The part of GitHub's push payload the decision reads: each pushed commit's SHA, in order. */
const PushPayload = Schema.fromJsonString(
  Schema.Struct({ commits: Schema.Array(Schema.Struct({ id: CommitSha })) })
);

/** The push payload is not the shape GitHub documents. */
class InvalidPushPayload extends Schema.TaggedError<InvalidPushPayload>()("InvalidPushPayload", {
  message: Schema.String,
}) {}

/** The push payload file could not be read. */
class PushPayloadUnreadable extends Schema.TaggedError<PushPayloadUnreadable>()("PushPayloadUnreadable", {
  message: Schema.String,
}) {}

/** The pushed commits, from the payload at GITHUB_EVENT_PATH. */
const pushedCommits = Effect.gen(function* () {
  const path = yield* Config.NonEmptyString("GITHUB_EVENT_PATH");
  const text = yield* (yield* FileSystem.FileSystem)
    .readFileString(path)
    .pipe(
      Effect.mapError(
        (error) => new PushPayloadUnreadable({ message: `Could not read ${path}: ${error.message}` })
      )
    );
  const payload = yield* Schema.decodeUnknownEffect(PushPayload)(text).pipe(
    Effect.mapError(
      () => new InvalidPushPayload({ message: "The push payload does not list its commits by SHA." })
    )
  );
  return payload.commits.map((commit) => commit.id);
});

const main = Effect.gen(function* () {
  const { skip, diagnostics } = yield* decide(yield* pushedCommits);
  yield* Effect.forEach(diagnostics, (line) => Console.error(line));
  yield* setSkipOutput(skip);
});

runStep(
  main.pipe(
    Effect.provide(
      GitHubPulls.layer.pipe(
        Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerUndici))
      )
    )
  )
);
