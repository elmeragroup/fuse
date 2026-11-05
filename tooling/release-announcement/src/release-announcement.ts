/**
 * The release announcement: finding the release a Publish Release run published, then announcing
 * it in Slack exactly once.
 *
 * The two operations run in different jobs of publish-release.yml. `findPublished` runs in the
 * publish job right after the engine, inside the `npm-release` concurrency group, so no other
 * publication can change the records between the engine finishing and the lookup. `announce` runs
 * in the notify job, one at a time per release, and uses Slack's history as the delivery receipt:
 * it posts only when the channel holds no message carrying the release's receipt, and posts once,
 * without retrying, so a lost response is settled by the next run's history check rather than by
 * a second post.
 */

import { Context, Data, DateTime, Effect, Match, Option, Schema } from "effect";

import * as Announcement from "./announcement.ts";
import type { ChatPostMessage, SlackChannelId } from "./announcement.ts";
import * as ReleaseRecord from "./release-record.ts";
import type { CommitSha, DamagedRecord, RecordTag, Release, StableVersion } from "./release-record.ts";
import { READ_LIMIT } from "./render-protocol.ts";
import type { Changelog, VersionNotes } from "./render-protocol.ts";

/** GitHub could not be asked about a record, or answered with neither the record nor 404. */
export class RecordsUnavailable extends Schema.TaggedError<RecordsUnavailable>()("RecordsUnavailable", {
  message: Schema.String,
}) {}

/** The published records the engine keeps, by tag. */
export class ReleaseRecords extends Context.Service<
  ReleaseRecords,
  {
    /**
     * The release a published record records. A draft record, as the engine leaves one it has
     * not finished, and a missing one are none alike.
     */
    readonly published: (
      tag: RecordTag
    ) => Effect.Effect<Option.Option<Release>, RecordsUnavailable | DamagedRecord>;
  }
>()("@elmeragroup/release-announcement/ReleaseRecords") {}

/** git could not read what a commit holds, such as for a commit missing from the clone. */
export class GitReadFailed extends Schema.TaggedError<GitReadFailed>()("GitReadFailed", {
  message: Schema.String,
}) {}

/** The package's release history in git: its changelog, version and the commit's subject. */
export class ChangelogSource extends Context.Service<
  ChangelogSource,
  {
    /**
     * The package changelog at `commit`, reading at most `limit` bytes of it, or none when the
     * commit has no changelog.
     */
    readonly changelog: (
      commit: CommitSha,
      limit: number
    ) => Effect.Effect<Option.Option<Changelog>, GitReadFailed>;

    /** The commit's subject line. */
    readonly subject: (commit: CommitSha) => Effect.Effect<string, GitReadFailed>;

    /** The stable version the package manifest at `commit` names. */
    readonly packageVersion: (commit: CommitSha) => Effect.Effect<StableVersion, GitReadFailed>;
  }
>()("@elmeragroup/release-announcement/ChangelogSource") {}

/**
 * Reads a version's notes from the changelog and renders them. It never fails: notes it cannot
 * read or render, in time or at all, are `Unreadable`, which the announcement links instead.
 */
export class NotesRenderer extends Context.Service<
  NotesRenderer,
  {
    /** The notes of `version` in `changelog`. */
    readonly render: (changelog: Changelog, version: StableVersion) => Effect.Effect<VersionNotes>;
  }
>()("@elmeragroup/release-announcement/NotesRenderer") {}

/** Slack answered a call with an error, such as `not_in_channel` or `missing_scope`. */
export class SlackRefused extends Schema.TaggedError<SlackRefused>()("SlackRefused", {
  message: Schema.String,
}) {}

/** Slack could not be reached, or sent an answer that does not read as one. */
export class SlackUnavailable extends Schema.TaggedError<SlackUnavailable>()("SlackUnavailable", {
  message: Schema.String,
}) {}

/**
 * The history check could not read all of the channel's history since the release was published,
 * so an earlier announcement cannot be ruled out: the channel holds more messages than the check
 * reads, Slack said more follows without a cursor to read it with, or Slack hides older messages
 * past a free workspace's history limit.
 */
export class HistoryUnchecked extends Schema.TaggedError<HistoryUnchecked>()("HistoryUnchecked", {
  message: Schema.String,
}) {}

/**
 * A post was sent and no answer confirmed or refused it, so Slack may hold it. The next run's
 * history check settles whether it landed.
 */
export class PostUnconfirmed extends Schema.TaggedError<PostUnconfirmed>()("PostUnconfirmed", {
  message: Schema.String,
}) {}

/** A message Slack holds, by its timestamp ID. */
type SlackMessage = { readonly ts: string };

/** A Slack channel the announcement reads and posts to. */
export class SlackChannel extends Context.Service<
  SlackChannel,
  {
    /**
     * The message in `channel` posted after `postedAfter` that carries `tag`'s receipt, if any.
     * It fails rather than answer none when it cannot read far enough to be sure.
     */
    readonly findAnnouncement: (
      channel: SlackChannelId,
      tag: RecordTag,
      postedAfter: DateTime.Utc
    ) => Effect.Effect<Option.Option<SlackMessage>, SlackRefused | SlackUnavailable | HistoryUnchecked>;

    /** Posts a message once. A post whose answer is lost fails with `PostUnconfirmed`. */
    readonly post: (message: ChatPostMessage) => Effect.Effect<SlackMessage, SlackRefused | PostUnconfirmed>;
  }
>()("@elmeragroup/release-announcement/SlackChannel") {}

/** What a Publish Release run was asked to do. */
export type Trigger = Data.TaggedEnum<{
  /** The call path: publish the checked commit, as a canary or, for a version commit, a stable. */
  Publish: { readonly commit: CommitSha };
  /** The dispatch path: retry exactly one recorded release. */
  Retry: { readonly tag: RecordTag };
}>;

/** Constructors and matchers for `Trigger`. */
export const Trigger = Data.taggedEnum<Trigger>();

/** Both the commit's canary record and its stable record are published. */
export class ConflictingRecords extends Schema.TaggedError<ConflictingRecords>()("ConflictingRecords", {
  message: Schema.String,
}) {}

/**
 * Finds the release a Publish Release run published, if any.
 *
 * A record turns from draft to published as the engine's last step, so a published candidate is
 * one this run's engine published or found published. The candidates are this run's own identity
 * only: on the retry path exactly its record tag; on the publish path `canary-<commit>`, and
 * `v<package version>` when that record's commit is this commit. A canary commit carries the
 * version of the last stable release, whose record belongs to an older commit and is not this
 * run's. A skipped or superseded canary leaves its candidates unpublished, so the run found none.
 *
 * @param trigger - What the run was asked to do.
 * @returns The published release, or none.
 */
export const findPublished = Effect.fn("ReleaseAnnouncement.findPublished")(function* (trigger: Trigger) {
  const records = yield* ReleaseRecords;
  if (trigger._tag === "Retry") return yield* records.published(trigger.tag);
  const { commit } = trigger;
  // The canary tag names the commit, so a published canary record of it is this run's.
  const canaryTag = ReleaseRecord.canaryTag(commit);
  const canary = yield* records.published(canaryTag);
  const stableTag = ReleaseRecord.stableTag(yield* (yield* ChangelogSource).packageVersion(commit));
  const stable = Option.filter(yield* records.published(stableTag), (release) => release.commit === commit);
  if (Option.isSome(canary) && Option.isSome(stable)) {
    return yield* new ConflictingRecords({
      message: `Both ${canaryTag} and ${stableTag} are published records of commit ${commit}`,
    });
  }
  return Option.orElse(canary, () => stable);
});

/** How a release is announced: the repository its links point into and the channels. */
type AnnouncementSettings = {
  readonly repository: URL;
  readonly channels: Announcement.Channels;
};

/** What announcing a release did. */
type Outcome = Data.TaggedEnum<{
  /** The release's channel is not set up, so nothing was read or posted. */
  Unrouted: Record<never, never>;
  /** The channel already holds the release's announcement, so nothing was posted. */
  AlreadyAnnounced: { readonly channel: SlackChannelId; readonly message: SlackMessage };
  Posted: { readonly channel: SlackChannelId; readonly message: SlackMessage };
}>;

/** Constructors and matchers for `Outcome`. */
const Outcome = Data.taggedEnum<Outcome>();

/**
 * How long before a release's publication its history check starts. An announcement always
 * follows its publication; the hour absorbs clock skew between GitHub and Slack.
 */
const CLOCK_SKEW = { hours: 1 } as const;

/**
 * Announces a release in its Slack channel unless the channel already holds its announcement.
 *
 * It builds the message first, so a release whose notes cannot be read fails before Slack is
 * asked anything; then it checks the channel's history from an hour before the publication, and
 * posts once. Any failure leaves the post unsent, except a post whose answer is lost.
 *
 * @param release - The published release.
 * @param settings - The repository and the channels.
 * @returns What was done.
 */
export const announce = Effect.fn("ReleaseAnnouncement.announce")(function* (
  release: Release,
  settings: AnnouncementSettings
) {
  const tag = ReleaseRecord.tagOf(release);
  yield* Effect.annotateCurrentSpan({ tag });
  const channel = settings.channels[release._tag];
  if (Option.isNone(channel)) return Outcome.Unrouted();
  const message = yield* messageFor(release, settings.repository);
  yield* Effect.logInfo(`The announcement of ${tag}`, message);
  const slack = yield* SlackChannel;
  const postedAfter = DateTime.subtract(release.publishedAt, CLOCK_SKEW);
  const earlier = yield* slack.findAnnouncement(channel.value, tag, postedAfter);
  if (Option.isSome(earlier))
    return Outcome.AlreadyAnnounced({ channel: channel.value, message: earlier.value });
  const posted = yield* slack.post(Announcement.postMessage(release, message, channel.value));
  return Outcome.Posted({ channel: channel.value, message: posted });
});

/** Builds a release's message, reading its notes or subject from git. */
const messageFor = Effect.fn("ReleaseAnnouncement.messageFor")(function* (release: Release, repository: URL) {
  const source = yield* ChangelogSource;
  return yield* Match.valueTags(release, {
    Stable: (stable) =>
      Effect.gen(function* () {
        const changelog = yield* source.changelog(stable.commit, READ_LIMIT);
        const notes: VersionNotes = Option.isNone(changelog)
          ? { _tag: "Missing" }
          : yield* (yield* NotesRenderer).render(changelog.value, stable.version);
        if (notes._tag === "Notes" && notes.extent._tag === "Shortened") {
          yield* Effect.annotateCurrentSpan({ shortenedBy: notes.extent.by });
        }
        if (notes._tag === "Unreadable")
          yield* Effect.logWarning(`The notes of ${stable.version} could not be shown: ${notes.cause}`);
        return Announcement.stable(stable, notes, repository);
      }),
    Canary: (canary) =>
      source
        .subject(canary.commit)
        .pipe(Effect.map((subject) => Announcement.canary(canary, subject, repository))),
  });
});
