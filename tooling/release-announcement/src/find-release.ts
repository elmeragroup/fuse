/**
 * Finds the release a Publish Release run published, for the notify job. It runs in the publish
 * job right after the engine, inside the `npm-release` concurrency group
 * (`ReleaseAnnouncement.findPublished` explains the candidates).
 *
 * It writes `tag`, the record tag, and `release`, the release as JSON, to GITHUB_OUTPUT, or
 * nothing when no candidate is published. Any failure, including a GitHub answer other than the
 * record or 404, fails the step, which the workflow lets fail without failing the publication.
 *
 * Usage: SOURCE_COMMIT=<sha> RECORD_TAG=<tag or empty> GH_TOKEN=<token> node find-release.ts
 */

import { NodeHttpClient, NodeServices } from "@effect/platform-node";
import { Config, Effect, Layer, Option, Schema } from "effect";

import * as GitChangelog from "./git-changelog.ts";
import { annotate, runStep, setOutputs } from "./github-actions.ts";
import * as GitHubReleases from "./github-releases.ts";
import { findPublished, Trigger } from "./release-announcement.ts";
import { CommitSha, RecordTag, ReleaseJson, tagOf } from "./release-record.ts";

/** Neither or both of SOURCE_COMMIT and RECORD_TAG is set. */
class InvalidTrigger extends Schema.TaggedError<InvalidTrigger>()("InvalidTrigger", {
  message: Schema.String,
}) {}

/** The run's trigger: RECORD_TAG on the retry path, SOURCE_COMMIT on the publish path. */
const trigger = Effect.gen(function* () {
  const recordTag = yield* Config.String("RECORD_TAG").pipe(Config.withDefault(""));
  const sourceCommit = yield* Config.String("SOURCE_COMMIT").pipe(Config.withDefault(""));
  if (recordTag !== "" && sourceCommit !== "") {
    return yield* new InvalidTrigger({ message: "Set SOURCE_COMMIT or RECORD_TAG, not both" });
  }
  if (recordTag !== "") {
    return Trigger.Retry({ tag: yield* Config.schema(RecordTag, "RECORD_TAG") });
  }
  if (sourceCommit !== "") {
    return Trigger.Publish({ commit: yield* Config.schema(CommitSha, "SOURCE_COMMIT") });
  }
  return yield* new InvalidTrigger({ message: "Set SOURCE_COMMIT or RECORD_TAG" });
});

const main = Effect.gen(function* () {
  const found = yield* findPublished(yield* trigger);
  if (Option.isNone(found)) {
    yield* annotate("notice", "This run published no release, so there is nothing to announce.");
    return;
  }
  const release = found.value;
  const tag = tagOf(release);
  const json = yield* Schema.encodeEffect(ReleaseJson)(release);
  yield* setOutputs([
    ["tag", tag],
    ["release", json],
  ]);
  yield* Effect.logInfo(`This run published ${tag}.`);
});

runStep(
  main.pipe(
    Effect.provide(
      Layer.mergeAll(GitHubReleases.layer, GitChangelog.layer).pipe(
        Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerUndici))
      )
    )
  )
);
