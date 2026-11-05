/**
 * Shared test data: releases parsed through the record schema, the changelog Changesets writes,
 * and readers of a message's blocks. Expected texts are written out by hand in the suites.
 */

import { Option, Schema } from "effect";

import { SlackChannelId } from "../src/announcement.ts";
import type { Message, MrkdwnText, SlackBlock } from "../src/announcement.ts";
import { versionNotes } from "../src/release-notes.ts";
import { Release } from "../src/release-record.ts";
import type { Canary, Stable } from "../src/release-record.ts";
import type { VersionNotes } from "../src/render-protocol.ts";

/** The web URL of the repository the Actions defaults name. */
export const repository = new URL("https://github.com/elmeragroup/fuse");

/** A commit of elmeragroup/fuse. */
export const commit = "699f103fc1dabe48cd1bdc48c85e446e68016395";

/** Another commit, whose stable release a later canary commit still carries the version of. */
export const olderCommit = "1e4f692496093af05992b7c989d853907c6ec95e";

/**
 * A published stable release of `sha`.
 *
 * @param version - Its version.
 * @param sha - Its commit.
 * @returns The release, parsed as the notify job parses one.
 */
export function stableRelease(version: string, sha: string = commit): Stable {
  const release = Schema.decodeUnknownSync(Release)({
    _tag: "Stable",
    version,
    commit: sha,
    url: `https://github.com/elmeragroup/fuse/releases/tag/v${version}`,
    publishedAt: "2026-11-06T12:00:00Z",
  });
  if (release._tag !== "Stable") throw new Error("not a stable release");
  return release;
}

/**
 * A published canary release of `sha`.
 *
 * @param version - Its version.
 * @param sha - Its commit.
 * @returns The release, parsed as the notify job parses one.
 */
export function canaryRelease(version: string, sha: string = commit): Canary {
  const release = Schema.decodeUnknownSync(Release)({
    _tag: "Canary",
    version,
    commit: sha,
    url: `https://github.com/elmeragroup/fuse/releases/tag/canary-${sha}`,
    publishedAt: "2026-11-05T09:15:14Z",
  });
  if (release._tag !== "Canary") throw new Error("not a canary release");
  return release;
}

/** The releases channel the suites announce stable releases in. */
export const releasesChannel = SlackChannelId.make("C0RELEASES");

/** The channel the suites announce canaries in. */
export const canaryChannel = SlackChannelId.make("C0CANARY");

/** About 1.1 MB of changelog entries, more than twice what is read. */
export const bulk = Array.from(
  { length: 10_000 },
  (_, index) => `- ${String(index).padStart(7, "0")}: ${"y".repeat(100)}`
).join("\n");

/**
 * The notes of `## 1.0.0` holding `markdown`, from a changelog read whole.
 *
 * @param markdown - The section's Markdown.
 * @returns Its notes.
 */
export function notesOf(markdown: string): VersionNotes {
  return versionNotes({ _tag: "Whole", text: `## 1.0.0\n\n${markdown}\n` }, "1.0.0");
}

/**
 * Notes the test needs shown.
 *
 * @param notes - The notes.
 * @returns Their sections and extent; throws for notes that are not shown.
 */
export function shown(notes: VersionNotes): Extract<VersionNotes, { readonly _tag: "Notes" }> {
  if (notes._tag !== "Notes") throw new Error(`no notes: ${notes._tag}`);
  return notes;
}

/** A changelog as `changeset version` writes it, with the inline Markdown changesets carry. */
export const changelog = `# @elmeragroup/fuse

## 0.2.0

### Minor Changes

- 3f2a1b4: Add the \`Carousel\` component with **snap points** and [keyboard support](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).

  Wrap the slides in \`<Carousel.Root>\` & keep <!channel> out.

### Patch Changes

- 9c8d7e6: Keep a device pixel for small non-zero \`Bar\` values in *every* chart.

## 0.1.0

### Minor Changes

- 1a2b3c4: First release.
`;

/** The 0.2.0 notes above, as Slack mrkdwn. */
export const notes020 = [
  "*Minor Changes*",
  "",
  "• 3f2a1b4: Add the `Carousel` component with *snap points* and <https://www.w3.org/WAI/ARIA/apg/patterns/carousel/|keyboard support>.",
  // A blank line inside a list item carries the item's indent, as Changesets writes it.
  "  ",
  "  Wrap the slides in `&lt;Carousel.Root&gt;` &amp; keep &lt;!channel&gt; out.",
  "",
  "*Patch Changes*",
  "",
  "• 9c8d7e6: Keep a device pixel for small non-zero `Bar` values in _every_ chart.",
].join("\n");

/**
 * A verbatim mrkdwn section block.
 *
 * @param text - Its text.
 * @returns The block.
 */
export function section(text: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text, verbatim: true } };
}

/**
 * A context block of one verbatim mrkdwn element.
 *
 * @param text - Its text.
 * @returns The block.
 */
export function context(text: string): SlackBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text, verbatim: true }] };
}

/** The context line that links the full notes of a shortened 1.0.0 announcement. */
export const shortenedNotice = context(
  "These notes are shortened. " +
    "<https://github.com/elmeragroup/fuse/blob/v1.0.0/packages/fuse/CHANGELOG.md#100|Read them in full>."
);

/**
 * The texts of a message's section blocks.
 *
 * @param message - The message.
 * @returns Each section's mrkdwn.
 */
export function sectionTexts(message: Message): string[] {
  return message.blocks.flatMap((block) => (block.type === "section" ? [block.text.text] : []));
}

/**
 * Every mrkdwn text object in a message's blocks.
 *
 * @param message - The message.
 * @returns The text objects of its sections and context blocks.
 */
export function mrkdwnObjects(message: Message): MrkdwnText[] {
  return message.blocks.flatMap((block): MrkdwnText[] => {
    if (block.type === "section") return [block.text];
    if (block.type === "context") return [...block.elements];
    return [];
  });
}

/** How often each mrkdwn delimiter occurs in a section. */
type Delimiters = {
  readonly "*": number;
  readonly _: number;
  readonly "~": number;
  readonly "`": number;
};

/**
 * The mrkdwn delimiters a reader meets in a section: `*`, `_` and `~` outside link targets and
 * code, and the backticks of code spans. A section renders on its own only when each is paired.
 *
 * @param text - The section's mrkdwn.
 * @returns The count of each delimiter.
 */
export function delimiters(text: string): Delimiters {
  const visible = text.replaceAll(/<[^<>|]*\|?/gu, "").replaceAll(/`[^`\n]*`/gu, "``");
  const count = (mark: string): number => visible.split(mark).length - 1;
  return { "*": count("*"), _: count("_"), "~": count("~"), "`": count("`") };
}

/**
 * The value of an option the test needs to be there.
 *
 * @param option - The option.
 * @returns Its value.
 */
export function present<A>(option: Option.Option<A>): A {
  return Option.getOrThrowWith(option, () => new Error("expected a value"));
}
