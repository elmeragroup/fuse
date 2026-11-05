/**
 * A version's section of a Changesets changelog, read as CommonMark: which part of the parsed
 * changelog the version's notes are, and whether the notes shown are all of them.
 *
 * The changelog is parsed by micromark as CommonMark with GitHub's strikethrough, so fences,
 * code, lists, emphasis and links read the way GitHub shows them. The section starts at the
 * root-level depth-2 heading whose text is the version and ends at the next root-level depth-2
 * heading, so a `## ` line inside a fence, an HTML comment or a list neither starts nor ends one.
 */

import { Option } from "effect";
import type { Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";

import { textOf } from "./markdown-text.ts";
import type { Changelog, Extent, ShortenedBy } from "./render-protocol.ts";

/** A version's section of a parsed changelog, or why there is none. */
export type Section =
  | {
      readonly _tag: "Found";
      /** The section's root-level nodes after its heading. */
      readonly nodes: readonly RootContent[];
      /** Whether the read part of the changelog ends inside the section. */
      readonly cutByReadLimit: boolean;
    }
  /** The changelog, read whole, has no `## <version>` heading. */
  | { readonly _tag: "Missing" }
  /** The heading, if any, lies past the part of the changelog that is read. */
  | { readonly _tag: "BeyondReadLimit" };

/**
 * The changelog's text as it is parsed: a prefix up to its last whole line, which also drops a
 * character cut in two.
 *
 * @param changelog - The part of the changelog that was read.
 * @returns The text to parse.
 */
export function sourceOf(changelog: Changelog): string {
  return changelog._tag === "Whole"
    ? changelog.text
    : changelog.text.slice(0, changelog.text.lastIndexOf("\n") + 1);
}

/**
 * The Markdown tree of a source, or none when micromark throws, which it does only on a defect of
 * its own.
 */
export const parse = Option.liftThrowable((source: string): Root =>
  fromMarkdown(source, {
    extensions: [gfmStrikethrough()],
    mdastExtensions: [gfmStrikethroughFromMarkdown()],
  })
);

/**
 * Selects a version's section from the parsed changelog.
 *
 * @param tree - The parsed changelog.
 * @param version - The version, as its heading names it.
 * @param changelog - What part of the changelog the tree was parsed from.
 * @returns The section and whether the read limit cut into it, or why there is none.
 */
export function select(tree: Root, version: string, changelog: Changelog): Section {
  const start = tree.children.findIndex((node) => isVersionHeading(node) && textOf(node) === version);
  if (start === -1) return changelog._tag === "Prefix" ? { _tag: "BeyondReadLimit" } : { _tag: "Missing" };
  const rest = tree.children.slice(start + 1);
  const end = rest.findIndex(isVersionHeading);
  return {
    _tag: "Found",
    nodes: end === -1 ? rest : rest.slice(0, end),
    // Without a next heading in what was read, a prefix ends inside the section.
    cutByReadLimit: end === -1 && changelog._tag === "Prefix",
  };
}

/**
 * How much of a section the notes show: shortened by what rendering left out, or by the read
 * limit cutting into the section, in that order of report; otherwise whole.
 *
 * @param section - The section shown.
 * @param rendering - What rendering left out, if anything.
 * @returns The extent.
 */
export function extentOf(
  section: Extract<Section, { readonly _tag: "Found" }>,
  rendering: Option.Option<ShortenedBy>
): Extent {
  const by = Option.orElse(rendering, () =>
    section.cutByReadLimit ? Option.some("read-limit" as const) : Option.none()
  );
  return Option.match(by, {
    onNone: () => ({ _tag: "Whole" }),
    onSome: (reason) => ({ _tag: "Shortened", by: reason }),
  });
}

function isVersionHeading(node: RootContent): boolean {
  return node.type === "heading" && node.depth === 2;
}
