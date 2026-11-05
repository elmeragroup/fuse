import { Option, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import * as Announcement from "../src/announcement.ts";
import { versionNotes } from "../src/release-notes.ts";
import {
  canaryChannel,
  canaryRelease,
  changelog,
  commit,
  context,
  mrkdwnObjects,
  notes020,
  releasesChannel,
  repository,
  section,
  sectionTexts,
  stableRelease,
} from "./fixtures.ts";

// Unit under test: the Announcement domain module. Oracles: Slack's mrkdwn rules (escape &, < and
// >; a link is <url|label>), Block Kit's text objects (verbatim stops mention parsing),
// chat.postMessage's arguments, the engine's record tags, and Slack's channel IDs. Expected
// messages are written out by hand.

/** Asserts that Slack will notify no one for a payload's text. */
function expectNoParsing(payload: Announcement.ChatPostMessage): void {
  const objects = mrkdwnObjects(payload);
  expect(objects.length).toBeGreaterThan(0);
  for (const object of objects) expect(object).toEqual({ type: "mrkdwn", text: object.text, verbatim: true });
  expect(payload).toMatchObject({ parse: "none", link_names: false });
}

describe("the stable announcement", () => {
  it("posts the version's notes and links, carrying the release's receipt", () => {
    const release = stableRelease("0.2.0");
    const message = Announcement.stable(
      release,
      versionNotes({ _tag: "Whole", text: changelog }, "0.2.0"),
      repository
    );
    expect(Announcement.postMessage(release, message, releasesChannel)).toEqual({
      channel: "C0RELEASES",
      text: "@elmeragroup/fuse 0.2.0 is released",
      blocks: [
        { type: "header", text: { type: "plain_text", text: "@elmeragroup/fuse 0.2.0" } },
        section(notes020),
        context(
          "<https://github.com/elmeragroup/fuse/releases/tag/v0.2.0|GitHub release> · " +
            "<https://www.npmjs.com/package/@elmeragroup/fuse/v/0.2.0|npm>"
        ),
        context("`pnpm add @elmeragroup/fuse@0.2.0`"),
      ],
      parse: "none",
      link_names: false,
      unfurl_links: false,
      unfurl_media: false,
      metadata: { event_type: "fuse_release_announced", event_payload: { tag: "v0.2.0" } },
    });
  });

  it("says the notes are missing for a commit without a changelog", () => {
    const message = Announcement.stable(stableRelease("0.3.0"), { _tag: "Missing" }, repository);
    expect(sectionTexts(message)).toEqual([
      "The changelog has no notes for 0.3.0. " +
        "<https://github.com/elmeragroup/fuse/blob/v0.3.0/packages/fuse/CHANGELOG.md|Open the changelog>",
    ]);
  });

  it.each(["parse-failed", "render-failed", "over-budget", "renderer-failed", "answer-too-large"] as const)(
    "keeps the header and links, and links the notes, when they could not be shown (%s)",
    (cause) => {
      const message = Announcement.stable(stableRelease("1.0.0"), { _tag: "Unreadable", cause }, repository);
      expect(message.blocks[0]).toEqual({
        type: "header",
        text: { type: "plain_text", text: "@elmeragroup/fuse 1.0.0" },
      });
      expect(sectionTexts(message)).toEqual([
        "The notes for 1.0.0 could not be shown here. " +
          "<https://github.com/elmeragroup/fuse/blob/v1.0.0/packages/fuse/CHANGELOG.md#100|Read them in the changelog>.",
      ]);
      expect(JSON.stringify(message)).toContain("|GitHub release>");
    }
  );

  it("posts mentions in a changelog as plain text", () => {
    const release = stableRelease("1.0.0");
    const message = Announcement.stable(
      release,
      versionNotes({ _tag: "Whole", text: "## 1.0.0\n\n- Ping @here and <!channel>.\n" }, "1.0.0"),
      repository
    );
    expect(sectionTexts(message)).toEqual(["• Ping @here and &lt;!channel&gt;."]);
    expectNoParsing(Announcement.postMessage(release, message, releasesChannel));
  });
});

describe("the canary announcement", () => {
  it("links the squash-merged PR, the commit and npm", () => {
    const release = canaryRelease("0.2.1-canary.0");
    const message = Announcement.canary(
      release,
      "Keep A Device Pixel For Small Non-Zero Bar Values (#456)",
      repository
    );
    expect(Announcement.postMessage(release, message, canaryChannel)).toEqual({
      channel: "C0CANARY",
      text: "@elmeragroup/fuse 0.2.1-canary.0: Keep A Device Pixel For Small Non-Zero Bar Values",
      blocks: [
        section(
          "*<https://www.npmjs.com/package/@elmeragroup/fuse/v/0.2.1-canary.0|@elmeragroup/fuse 0.2.1-canary.0>*\n" +
            "<https://github.com/elmeragroup/fuse/pull/456|Keep A Device Pixel For Small Non-Zero Bar Values> (#456)" +
            ` · <https://github.com/elmeragroup/fuse/commit/${commit}|${commit.slice(0, 7)}>`
        ),
        context("`pnpm add @elmeragroup/fuse@0.2.1-canary.0`"),
      ],
      parse: "none",
      link_names: false,
      unfurl_links: false,
      unfurl_media: false,
      metadata: { event_type: "fuse_release_announced", event_payload: { tag: `canary-${commit}` } },
    });
  });

  it("posts mentions in a PR title as plain text", () => {
    const release = canaryRelease("0.2.1-canary.0");
    const message = Announcement.canary(release, "Ping @here @channel @everyone <!here> (#12)", repository);
    expect(message.text).toBe(
      "@elmeragroup/fuse 0.2.1-canary.0: Ping @here @channel @everyone &lt;!here&gt;"
    );
    expect(sectionTexts(message)[0]).toContain(
      "<https://github.com/elmeragroup/fuse/pull/12|Ping @here @channel @everyone &lt;!here&gt;> (#12)"
    );
    expectNoParsing(Announcement.postMessage(release, message, canaryChannel));
  });

  it("escapes a subject without a PR number and links only the commit", () => {
    const message = Announcement.canary(
      canaryRelease("0.2.1-canary.0"),
      'Revert "Use <dialog>" & <!here>',
      repository
    );
    expect(message.text).toBe(
      '@elmeragroup/fuse 0.2.1-canary.0: Revert "Use &lt;dialog&gt;" &amp; &lt;!here&gt;'
    );
    expect(sectionTexts(message)).toEqual([
      "*<https://www.npmjs.com/package/@elmeragroup/fuse/v/0.2.1-canary.0|@elmeragroup/fuse 0.2.1-canary.0>*\n" +
        'Revert "Use &lt;dialog&gt;" &amp; &lt;!here&gt;' +
        ` · <https://github.com/elmeragroup/fuse/commit/${commit}|${commit.slice(0, 7)}>`,
    ]);
  });

  it("cuts a subject longer than 500 characters", () => {
    const message = Announcement.canary(
      canaryRelease("0.2.1-canary.0"),
      `${"x".repeat(600)} (#7)`,
      repository
    );
    expect(message.text).toBe(`@elmeragroup/fuse 0.2.1-canary.0: ${"x".repeat(499)}…`);
  });

  it.each([
    // The title keeps 499 units at most, one fewer than the limit, for the ellipsis. Each subject
    // is one unit off a whole number of characters there, so a cut by units would split one.
    // 2 + 248 × 2 = 498; the next emoji would end at 500.
    { case: "emoji", subject: `ab${"😀".repeat(300)}`, title: `ab${"😀".repeat(248)}…` },
    // A flag is four units: 2 + 124 × 4 = 498.
    { case: "flags", subject: `ab${"🇳🇴".repeat(150)}`, title: `ab${"🇳🇴".repeat(124)}…` },
    // An accented letter is two units: 2 + 248 × 2 = 498.
    { case: "accented letters", subject: `xy${"e\u0301".repeat(300)}`, title: `xy${"e\u0301".repeat(248)}…` },
  ])("cuts a subject of $case between whole characters", ({ subject, title }) => {
    const message = Announcement.canary(canaryRelease("0.2.1-canary.0"), `${subject} (#7)`, repository);
    expect(message.text).toBe(`@elmeragroup/fuse 0.2.1-canary.0: ${title}`);
    expect(sectionTexts(message)[0]).toContain(`|${title}> (#7)`);
    for (const text of [message.text, ...sectionTexts(message)]) expect(text.isWellFormed()).toBe(true);
  });
});

describe("channel settings", () => {
  it.each([
    { setting: "C0123456789", parsed: Option.some("C0123456789") },
    { setting: " C0CANARY ", parsed: Option.some("C0CANARY") },
    { setting: "", parsed: Option.none() },
    { setting: "  ", parsed: Option.none() },
  ])("reads the channel setting $setting", ({ setting, parsed }) => {
    expect(Announcement.parseChannelSetting("SLACK_RELEASES_CHANNEL", setting)).toEqual(
      Result.succeed(parsed)
    );
  });

  it.each([
    { setting: "#releases", message: '"#releases" is not a Slack channel ID such as C0123456789' },
    {
      setting: "C0REL\npost=true",
      message: '"C0REL\\npost=true" is not a Slack channel ID such as C0123456789',
    },
    { setting: "c0releases", message: '"c0releases" is not a Slack channel ID such as C0123456789' },
  ])("rejects the channel setting $setting, naming the variable", ({ setting, message }) => {
    const parsed = Announcement.parseChannelSetting("SLACK_CANARY_CHANNEL", setting);
    expect(Result.isFailure(parsed) && parsed.failure.message).toBe(`SLACK_CANARY_CHANNEL: ${message}`);
  });
});

describe("receipts", () => {
  it("reads the receipt an announcement's metadata carries", () => {
    const posted = Announcement.postMessage(
      stableRelease("0.2.0"),
      { text: "", blocks: [] },
      releasesChannel
    );
    const receipt = Schema.decodeUnknownSync(Announcement.Receipt)(
      JSON.parse(JSON.stringify(posted.metadata))
    );
    expect(receipt).toEqual({ event_type: "fuse_release_announced", event_payload: { tag: "v0.2.0" } });
  });

  it.each([
    { case: "another app's event", metadata: { event_type: "deploy", event_payload: { tag: "v0.2.0" } } },
    {
      case: "a receipt without a tag",
      metadata: { event_type: "fuse_release_announced", event_payload: {} },
    },
    { case: "no metadata", metadata: undefined },
  ])("reads no receipt from $case", ({ metadata }) => {
    expect(Option.isNone(Schema.decodeUnknownOption(Announcement.Receipt)(metadata))).toBe(true);
  });
});
