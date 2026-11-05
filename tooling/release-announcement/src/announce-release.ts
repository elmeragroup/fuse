/**
 * Announces the release a Publish Release run published in Slack: stable releases in
 * SLACK_RELEASES_CHANNEL and canaries in SLACK_CANARY_CHANNEL. It runs in the notify job, one at
 * a time per release, after the publish job found the release (`find-release.ts`).
 *
 * An unset SLACK_BOT_TOKEN or channel variable skips the announcement with a notice, so publishing
 * can go live before Slack is set up. A release the channel already announces is not posted again:
 * delete its message, then re-run the job, to post it again.
 *
 * Usage: RELEASE=<release JSON> SLACK_BOT_TOKEN=<token> node announce-release.ts
 */

import { NodeHttpClient, NodeServices } from "@effect/platform-node";
import { Config, Effect, Layer, Match, Option, Schema } from "effect";

import { baseUrlSetting, repositorySetting, under } from "./addresses.ts";
import { parseChannelSetting } from "./announcement.ts";
import * as GitChangelog from "./git-changelog.ts";
import { annotate, runStep } from "./github-actions.ts";
import * as IsolatedNotes from "./isolated-notes.ts";
import { announce, PostUnconfirmed } from "./release-announcement.ts";
import { ReleaseJson, tagOf } from "./release-record.ts";
import * as SlackWebApi from "./slack-web-api.ts";

/** The variable that names each release channel's Slack channel. */
const CHANNEL_VARIABLES = { Stable: "SLACK_RELEASES_CHANNEL", Canary: "SLACK_CANARY_CHANNEL" } as const;

/** A setting of the job does not parse. */
class InvalidSetting extends Schema.TaggedError<InvalidSetting>()("InvalidSetting", {
  message: Schema.String,
}) {}

/** A channel variable, parsed: a channel, or none while it is unset or empty. */
const channelSetting = (name: string) =>
  Effect.gen(function* () {
    const setting = yield* Config.String(name).pipe(Config.withDefault(""));
    return yield* Effect.fromResult(parseChannelSetting(setting)).pipe(
      Effect.mapError((error) => new InvalidSetting({ message: `${name}: ${error.message}` }))
    );
  });

/** The job's settings, from its environment and the Actions defaults. */
const settings = Effect.gen(function* () {
  const release = yield* Config.schema(ReleaseJson, "RELEASE");
  const server = yield* baseUrlSetting("GITHUB_SERVER_URL");
  const { owner, name } = yield* repositorySetting("GITHUB_REPOSITORY");
  const channels = {
    stable: yield* channelSetting(CHANNEL_VARIABLES.Stable),
    canary: yield* channelSetting(CHANNEL_VARIABLES.Canary),
  };
  // An empty secret is how Actions passes one that is not set.
  const token = yield* Config.schema(Schema.Redacted(Schema.NonEmptyString), "SLACK_BOT_TOKEN").pipe(
    Config.option,
    Config.orElse(() => Config.succeed(Option.none()))
  );
  return { release, repository: under(server, [owner, name]), channels, token };
});

const main = Effect.gen(function* () {
  const { release, repository, channels, token } = yield* settings;
  const tag = tagOf(release);
  if (Option.isNone(token)) {
    yield* annotate("notice", "The SLACK_BOT_TOKEN secret is not set, so the release is not announced.");
    return;
  }
  const outcome = yield* announce(release, { repository, channels }).pipe(
    Effect.provide(SlackWebApi.layer(token.value))
  );
  yield* Match.valueTags(outcome, {
    Unrouted: () =>
      annotate(
        "notice",
        `The ${CHANNEL_VARIABLES[release._tag]} variable is not set, so the ${release._tag === "Stable" ? "stable" : "canary"} release is not announced.`
      ),
    AlreadyAnnounced: ({ channel, message }) =>
      annotate(
        "notice",
        `${tag} is already announced in Slack (${channel}, message ${message.ts}). Delete that message, then re-run this job to post it again.`
      ),
    Posted: ({ channel, message }) =>
      annotate("notice", `Announced ${tag} in Slack (${channel}, message ${message.ts}).`),
  });
});

runStep(
  main.pipe(
    Effect.catchTag("PostUnconfirmed", (error) =>
      Effect.fail(
        new PostUnconfirmed({
          message: `${error.message}. Re-run this job: it checks the channel's history first and posts only if the first post did not land.`,
        })
      )
    ),
    Effect.provide(
      Layer.mergeAll(GitChangelog.layer, IsolatedNotes.layer).pipe(
        Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerUndici))
      )
    )
  )
);
