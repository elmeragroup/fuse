/**
 * The Slack announcement of a published release: which channel it goes to, the Block Kit message,
 * the `chat.postMessage` arguments that post it, and the message metadata that marks it as the
 * release's announcement.
 *
 * Every text object is mrkdwn with `verbatim: true`, and the top-level text is posted with
 * `parse: "none"` and `link_names: false`, so an `@here`, `@channel`, `@everyone`, `#channel` or
 * bare URL in a PR title or changelog stays plain text and notifies no one. Links this module
 * writes as `<url|label>` still work, and text from the release is escaped by Slack's rule.
 */

import { Match, Option, Result, Schema } from "effect";
import { Url } from "effect/http";

import { PathSegment, under } from "./addresses.ts";
import { escapeText, link } from "./mrkdwn.ts";
import { stableTag, tagOf } from "./release-record.ts";
import type { Canary, CanaryVersion, RecordTag, Release, Stable, StableVersion } from "./release-record.ts";
import type { VersionNotes } from "./render-protocol.ts";
import { cutText } from "./text-cut.ts";

const PACKAGE_NAME = "@elmeragroup/fuse";

/** The changelog `changeset version` writes, read at the release commit. */
export const CHANGELOG_PATH = "packages/fuse/CHANGELOG.md";

/** The path segments of links this module builds, all constant. */
const CHANGELOG_SEGMENTS = CHANGELOG_PATH.split("/").map((segment) => PathSegment.make(segment));
const PACKAGE_SEGMENTS = ["package", ...PACKAGE_NAME.split("/")].map((segment) => PathSegment.make(segment));
const BLOB = PathSegment.make("blob");
const PULL = PathSegment.make("pull");
const COMMIT = PathSegment.make("commit");
const V = PathSegment.make("v");

/** npm's web home, which version pages lie under. */
const NPM = new URL("https://www.npmjs.com");

/** Slack's limit for a header's text (docs.slack.dev, Block Kit). */
const HEADER_TEXT_LIMIT = 150;

/** Squash subjects are PR titles and far shorter; a longer one is cut so its section fits. */
const SUBJECT_LIMIT = 500;

/** A Slack conversation ID, such as `C0123456789`. A `#name` does not identify a channel. */
export const SlackChannelId = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Z0-9]+$/u, { message: "a Slack channel ID such as C0123456789" })),
  Schema.brand("SlackChannelId")
);

/** A parsed Slack channel ID. */
export type SlackChannelId = typeof SlackChannelId.Type;

/** A setting of the job that does not parse, naming the setting. */
export class InvalidSetting extends Schema.TaggedError<InvalidSetting>()("InvalidSetting", {
  message: Schema.String,
}) {}

/**
 * Parses a channel setting: a Slack channel ID, or empty while the channel is not set up.
 * Surrounding whitespace is ignored.
 *
 * @param name - The setting's name, for the error.
 * @param setting - The setting's raw value.
 * @returns The channel, none for an empty setting, or `InvalidSetting`.
 */
export function parseChannelSetting(
  name: string,
  setting: string
): Result.Result<Option.Option<SlackChannelId>, InvalidSetting> {
  const trimmed = setting.trim();
  if (trimmed === "") return Result.succeed(Option.none());
  return Schema.decodeUnknownResult(SlackChannelId)(trimmed).pipe(
    Result.map(Option.some),
    Result.mapError(
      () =>
        new InvalidSetting({
          message: `${name}: ${JSON.stringify(trimmed)} is not a Slack channel ID such as C0123456789`,
        })
    )
  );
}

/**
 * Where each release channel is announced, by the release's kind: stable releases to the releases
 * channel, canaries to the canary channel; none while its Slack channel is not set up.
 */
export type Channels = { readonly [Kind in Release["_tag"]]: Option.Option<SlackChannelId> };

/** A mrkdwn text object, posted verbatim so Slack links and mentions nothing by itself. */
export type MrkdwnText = { readonly type: "mrkdwn"; readonly text: string; readonly verbatim: true };

/** The Block Kit blocks an announcement uses. */
export type SlackBlock =
  | { readonly type: "header"; readonly text: { readonly type: "plain_text"; readonly text: string } }
  | { readonly type: "section"; readonly text: MrkdwnText }
  | { readonly type: "context"; readonly elements: readonly MrkdwnText[] };

/** A Slack message: blocks, and the plain `text` Slack shows in notifications. */
export type Message = {
  readonly text: string;
  readonly blocks: readonly SlackBlock[];
};

/**
 * The stable announcement: the version as a header, the version's changelog section as mrkdwn,
 * then links to the GitHub release and the npm version. Notes over four sections are cut with a
 * link to the changelog; notes the parser could not read, or that lie past what it reads, are only
 * linked.
 *
 * @param release - The stable release.
 * @param notes - Its version's notes, or why there are none.
 * @param repository - The repository's web URL, such as `https://github.com/elmeragroup/fuse`.
 * @returns The message.
 */
export function stable(release: Stable, notes: VersionNotes, repository: URL): Message {
  const { version } = release;
  // A stable tag is letters, digits and dots, so it is a path segment as it stands.
  const changelog = under(repository, [BLOB, PathSegment.make(stableTag(version)), ...CHANGELOG_SEGMENTS]);
  const changelogUrl = changelog.href;
  // GitHub anchors a `## 1.2.0` heading as `#120`.
  const fullNotes = Url.setHash(changelog, version.replaceAll(".", "")).href;
  const missing = mrkdwnSection(
    `The changelog has no notes for ${version}. ${slackLink(changelogUrl, "Open the changelog")}`
  );
  const unshown = (reason: string) =>
    mrkdwnSection(
      `The notes for ${version} ${reason}. ${slackLink(fullNotes, "Read them in the changelog")}.`
    );
  const noteBlocks = Match.valueTags(notes, {
    Notes: ({ sections }) => (sections.length === 0 ? [missing] : sections.map(mrkdwnSection)),
    Missing: () => [missing],
    BeyondReadLimit: () => [unshown("are too large to show here")],
    Unreadable: () => [unshown("could not be shown here")],
  });
  const shortened =
    notes._tag === "Notes" && notes.extent._tag === "Shortened"
      ? [context(`These notes are shortened. ${slackLink(fullNotes, "Read them in full")}.`)]
      : [];
  const links = [slackLink(release.url, "GitHub release"), slackLink(npmUrl(version), "npm")];
  return {
    text: escapeText(`${PACKAGE_NAME} ${version} is released`),
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: shorten(`${PACKAGE_NAME} ${version}`, HEADER_TEXT_LIMIT) },
      },
      ...noteBlocks,
      ...shortened,
      context(links.join(" · ")),
      context(`\`pnpm add ${PACKAGE_NAME}@${version}\``),
    ],
  };
}

/**
 * The canary announcement: the version linked to npm, the merged PR's title linked to the PR,
 * the commit, and the install command.
 *
 * @param release - The canary release.
 * @param subject - The release commit's subject, a squash merge's `<PR title> (#<number>)`.
 * @param repository - The repository's web URL, such as `https://github.com/elmeragroup/fuse`.
 * @returns The message.
 */
export function canary(release: Canary, subject: string, repository: URL): Message {
  const { version, commit } = release;
  const squash = squashSubject(subject);
  const title = shorten(
    Option.match(squash, { onNone: () => subject, onSome: (s) => s.title }),
    SUBJECT_LIMIT
  );
  const change = Option.match(squash, {
    onNone: () => escapeText(title),
    onSome: ({ number }) => `${slackLink(under(repository, [PULL, number]).href, title)} (#${number})`,
  });
  // A commit SHA is hex digits, so it is a path segment as it stands.
  const commitLink = slackLink(
    under(repository, [COMMIT, PathSegment.make(commit)]).href,
    commit.slice(0, 7)
  );
  return {
    text: escapeText(`${PACKAGE_NAME} ${version}: ${title}`),
    blocks: [
      mrkdwnSection(
        `*${slackLink(npmUrl(version), `${PACKAGE_NAME} ${version}`)}*\n${change} · ${commitLink}`
      ),
      context(`\`pnpm add ${PACKAGE_NAME}@${version}\``),
    ],
  };
}

/** A squash-merge subject's PR title and number. */
type SquashSubject = { readonly title: string; readonly number: PathSegment };

/** Parses a squash-merge subject, the PR title then ` (#<number>)`. */
function squashSubject(subject: string): Option.Option<SquashSubject> {
  const open = subject.lastIndexOf(" (#");
  if (open <= 0 || !subject.endsWith(")")) return Option.none();
  const number = subject.slice(open + " (#".length, -1);
  const title = subject.slice(0, open).trimEnd();
  return /^\d+$/u.test(number) && title !== ""
    ? Option.some({ title, number: PathSegment.make(number) })
    : Option.none();
}

/** A version's page on npm. Versions are digits, dots, dashes and letters, so path segments. */
function npmUrl(version: StableVersion | CanaryVersion): string {
  return under(NPM, [...PACKAGE_SEGMENTS, V, PathSegment.make(version)]).href;
}

function mrkdwnSection(text: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text, verbatim: true } };
}

function context(text: string): SlackBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text, verbatim: true }] };
}

/** `text` within `limit` units, cut between grapheme clusters and ended with an ellipsis. */
function shorten(text: string, limit: number): string {
  return text.length <= limit ? text : `${cutText(text, limit - 1).trimEnd()}…`;
}

/** A Slack link to `url` with an escaped label. */
function slackLink(url: string, label: string): string {
  return link(url, escapeText(label));
}

/**
 * The message metadata event every announcement carries. The channel's history finds an earlier
 * announcement of a release by this event and the record tag in its payload, so Slack itself is
 * the delivery receipt.
 */
const ANNOUNCEMENT_EVENT = "fuse_release_announced";

/** The `chat.postMessage` arguments of an announcement. */
export type ChatPostMessage = Message & {
  readonly channel: SlackChannelId;
  /** Leaves the top-level `text` unlinked and without mention parsing, as `verbatim` does for blocks. */
  readonly parse: "none";
  readonly link_names: false;
  /** A PR or npm unfurl would outgrow the message. */
  readonly unfurl_links: false;
  readonly unfurl_media: false;
  readonly metadata: {
    readonly event_type: typeof ANNOUNCEMENT_EVENT;
    readonly event_payload: { readonly tag: RecordTag };
  };
};

/**
 * The `chat.postMessage` arguments that post a release's message to its channel.
 *
 * @param release - The release the message announces.
 * @param message - The message.
 * @param channel - The release's channel.
 * @returns The arguments, carrying the release's receipt as metadata.
 */
export function postMessage(release: Release, message: Message, channel: SlackChannelId): ChatPostMessage {
  return {
    channel,
    ...message,
    parse: "none",
    link_names: false,
    unfurl_links: false,
    unfurl_media: false,
    metadata: { event_type: ANNOUNCEMENT_EVENT, event_payload: { tag: tagOf(release) } },
  };
}

/**
 * The metadata of an announcement, as `conversations.history` returns it with
 * `include_all_metadata`. Other messages carry no metadata or another app's event.
 */
export const Receipt = Schema.Struct({
  event_type: Schema.Literal(ANNOUNCEMENT_EVENT),
  event_payload: Schema.Struct({ tag: Schema.String }),
});
