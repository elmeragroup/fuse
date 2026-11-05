import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Result, Schema } from "effect";

import * as Announcement from "../src/announcement.ts";
import type { ChatPostMessage, SlackChannelId } from "../src/announcement.ts";
import { Changelog } from "../src/changelog-section.ts";
import {
  announce,
  ChangelogSource,
  findPublished,
  GitReadFailed,
  ReleaseRecords,
  NotesRenderer,
  SlackChannel,
  Trigger,
} from "../src/release-announcement.ts";
import { versionNotes } from "../src/release-notes.ts";
import { CommitSha, RecordTag, StableVersion } from "../src/release-record.ts";
import type { Release } from "../src/release-record.ts";
import {
  canaryRelease,
  changelog,
  commit,
  olderCommit,
  present,
  repository,
  stableRelease,
} from "./fixtures.ts";

// Unit under test: the ReleaseAnnouncement application service, through its ports. Oracles: the
// engine's identity rules (a run's records are `canary-<commit>`, or `v<package version>` when that
// record's commit is the run's), and the history window an announcement is looked for in. These
// are the policies the CLI suites cannot reach: GitHub never holds both of a commit's records, a
// retry's draft record, or a canary beside an older commit's stable release in those suites, and
// Slack's message times are the stand-in's own clock. The CLI suites cover posting, re-runs, lost
// answers and Slack's failures.

const sha = Schema.decodeUnknownSync(CommitSha);
const tag = Schema.decodeUnknownSync(RecordTag);

/** Records GitHub publishes, by tag; any other tag is a draft or missing. */
function recordsLayer(published: readonly Release[]) {
  return Layer.succeed(
    ReleaseRecords,
    ReleaseRecords.of({
      published: (asked) =>
        Effect.succeed(
          Option.fromNullishOr(
            published.find(
              (release) =>
                (release._tag === "Stable" ? `v${release.version}` : `canary-${release.commit}`) === asked
            )
          )
        ),
    })
  );
}

/** One commit of a scratch history: its changelog, subject and package version. */
type CommitFixture = {
  readonly changelog: string | undefined;
  readonly subject: string;
  readonly version: string;
};

/** A git history of the given commits; any other commit is missing from the clone. */
function changelogLayer(commits: ReadonlyMap<string, CommitFixture>) {
  const find = (asked: string): Effect.Effect<CommitFixture, GitReadFailed> => {
    const found = commits.get(asked);
    return found === undefined
      ? Effect.fail(new GitReadFailed({ message: `git could not read ${asked}`, read: asked }))
      : Effect.succeed(found);
  };
  return Layer.succeed(
    ChangelogSource,
    ChangelogSource.of({
      changelog: (asked, limit) =>
        find(asked).pipe(
          Effect.map(({ changelog: text }) =>
            Option.map(Option.fromNullishOr(text), (whole) =>
              whole.length > limit
                ? Changelog.Prefix({ text: whole.slice(0, limit) })
                : Changelog.Whole({ text: whole })
            )
          )
        ),
      subject: (asked) => find(asked).pipe(Effect.map(({ subject }) => subject)),
      packageVersion: (asked) =>
        find(asked).pipe(Effect.map(({ version }) => Schema.decodeUnknownSync(StableVersion)(version))),
    })
  );
}

/** The notes renderer, in this process and without a time limit. */
const inProcessNotes = Layer.succeed(
  NotesRenderer,
  NotesRenderer.of({ render: (changelog, version) => Effect.sync(() => versionNotes(changelog, version)) })
);

/** A message the channel holds, and when it was posted. */
type HeldMessage = {
  readonly ts: string;
  readonly postedAt: DateTime.Utc;
  readonly payload: ChatPostMessage;
};

/**
 * An in-memory Slack channel holding messages posted at given times. It answers the history from
 * the messages posted after the asked time, and stores what is posted to it.
 */
class FakeSlack {
  readonly held: HeldMessage[] = [];

  /**
   * Seeds a message posted at `postedAt`.
   *
   * @param payload - What was posted.
   * @param postedAt - When.
   */
  hold(payload: ChatPostMessage, postedAt: DateTime.Utc): void {
    this.held.push({ ts: `${String(this.held.length + 1)}.000100`, postedAt, payload });
  }

  readonly layer = Layer.sync(SlackChannel, () =>
    SlackChannel.of({
      findAnnouncement: (channel: SlackChannelId, asked, postedAfter) =>
        Effect.succeed(
          Option.map(
            Option.fromNullishOr(
              this.held.find(
                (message) =>
                  message.payload.channel === channel &&
                  DateTime.isGreaterThan(message.postedAt, postedAfter) &&
                  message.payload.metadata.event_payload.tag === asked
              )
            ),
            ({ ts }) => ({ ts })
          )
        ),
      post: (payload) =>
        Effect.sync(() => {
          this.hold(payload, DateTime.makeUnsafe("2026-11-06T12:05:00Z"));
          return { ts: this.held.at(-1)?.ts ?? "" };
        }),
    })
  );
}

const releasesChannel = present(Result.getOrThrow(Announcement.parseChannelSetting("C0RELEASES")));
const canaryChannel = present(Result.getOrThrow(Announcement.parseChannelSetting("C0CANARY")));
const settings = {
  repository,
  channels: { stable: Option.some(releasesChannel), canary: Option.some(canaryChannel) },
} as const;

const history = new Map<string, CommitFixture>([
  [commit, { changelog, subject: "Version Packages (#460)", version: "0.2.0" }],
  [olderCommit, { changelog, subject: "Keep A Device Pixel (#456)", version: "0.2.0" }],
]);

describe("finding the release a run published", () => {
  const canary = canaryRelease("0.2.1-canary.0", commit);
  const ownStable = stableRelease("0.2.0", commit);
  const olderStable = stableRelease("0.2.0", olderCommit);
  const find = (trigger: Trigger, published: readonly Release[]) =>
    findPublished(trigger).pipe(
      Effect.provide(Layer.mergeAll(recordsLayer(published), changelogLayer(history)))
    );
  const publish = Trigger.Publish({ commit: sha(commit) });

  it.effect("keeps the canary when its version's stable release is an older commit's", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* find(publish, [canary, olderStable]), Option.some(canary));
    })
  );

  it.effect("refuses to choose when both of the commit's records are published", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(find(publish, [canary, ownStable]));
      assert.strictEqual(error._tag, "ConflictingRecords");
    })
  );

  it.effect("finds nothing for a retry that left its record a draft", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* find(Trigger.Retry({ tag: tag(`canary-${commit}`) }), []), Option.none());
    })
  );
});

describe("announcing a release", () => {
  const release = stableRelease("0.2.0", commit);
  const run = (slack: FakeSlack, notes = inProcessNotes) =>
    announce(release, settings).pipe(
      Effect.provide(Layer.mergeAll(slack.layer, changelogLayer(history), notes))
    );

  it.effect("posts the release with its notes linked when the renderer could not show them", () =>
    Effect.gen(function* () {
      // The isolated renderer answers over-budget for a process it stopped (isolated-notes.test.ts);
      // this renderer answers so at once, so the post's fallback does not wait on a parser.
      const stopped = Layer.succeed(
        NotesRenderer,
        NotesRenderer.of({ render: () => Effect.succeed({ _tag: "Unreadable", cause: "over-budget" }) })
      );
      const slack = new FakeSlack();
      assert.strictEqual((yield* run(slack, stopped))._tag, "Posted");
      const posted = slack.held.at(-1)?.payload;
      assert.deepStrictEqual(posted?.blocks, [
        { type: "header", text: { type: "plain_text", text: "@elmeragroup/fuse 0.2.0" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "The notes for 0.2.0 could not be shown here. " +
              "<https://github.com/elmeragroup/fuse/blob/v0.2.0/packages/fuse/CHANGELOG.md#020|Read them in the changelog>.",
            verbatim: true,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text:
                "<https://github.com/elmeragroup/fuse/releases/tag/v0.2.0|GitHub release> · " +
                "<https://www.npmjs.com/package/@elmeragroup/fuse/v/0.2.0|npm>",
              verbatim: true,
            },
          ],
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: "`pnpm add @elmeragroup/fuse@0.2.0`", verbatim: true }],
        },
      ]);
    })
  );

  it.effect(
    "counts only messages from an hour before the publication, so an older receipt does not hide it",
    () =>
      Effect.gen(function* () {
        const slack = new FakeSlack();
        const payload = Announcement.postMessage(release, { text: "", blocks: [] }, releasesChannel);
        // The release was published at 12:00; 10:59 is outside the check's hour of skew, 11:01 inside.
        slack.hold(payload, DateTime.makeUnsafe("2026-11-06T10:59:00Z"));
        assert.strictEqual((yield* run(slack))._tag, "Posted");
        const skewed = new FakeSlack();
        skewed.hold(payload, DateTime.makeUnsafe("2026-11-06T11:01:00Z"));
        assert.strictEqual((yield* run(skewed))._tag, "AlreadyAnnounced");
      })
  );
});
