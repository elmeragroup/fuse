/**
 * What the deck reads from a slide besides its content: the frontmatter and the title. Both come
 * from the mdast tree the slide's MDX compile builds (`src/bundler/mdx.ts`), so a block MDX treats
 * as frontmatter, or a heading MDX renders, is the one the deck reads. The frontmatter holds only
 * `layout` and `notes`; the title is the slide's first heading.
 */

import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type { Nodes, Root } from "mdast";
import { parse as parseYaml } from "yaml";

import { DEFAULT_LAYOUT, LAYOUT_NAMES } from "./vocabulary.ts";
import type { LayoutName } from "./vocabulary.ts";

/** A slide's frontmatter as the author writes it. */
const Frontmatter = Schema.Struct({
  layout: Schema.optionalKey(Schema.Literals(LAYOUT_NAMES)),
  notes: Schema.optionalKey(Schema.String),
});

const decodeFrontmatter = Schema.decodeUnknownResult(Frontmatter);

/** What the deck reads from a slide's frontmatter and headings. */
export type SlideSource = {
  /** The slide's layout, `content` when the frontmatter names none. */
  readonly layout: LayoutName;
  /** The speaker notes. */
  readonly notes: Option.Option<string>;
  /** The text of the slide's first heading. */
  readonly title: Option.Option<string>;
};

/** A slide's frontmatter is not YAML, or holds a key or value the deck does not know. */
export class SlideFrontmatterInvalid extends Schema.TaggedError<SlideFrontmatterInvalid>()(
  "SlideFrontmatterInvalid",
  {
    message: Schema.String,
    hint: Schema.String,
    id: Schema.String,
  }
) {}

/**
 * Read a slide's frontmatter and title from its parsed tree.
 *
 * @param id - The slide, for the error.
 * @param tree - The slide's mdast tree, parsed with `remark-frontmatter`.
 * @returns What the deck reads from it, or `SlideFrontmatterInvalid`.
 */
export function readSlideSource(id: string, tree: Root): Result.Result<SlideSource, SlideFrontmatterInvalid> {
  const invalid = (reason: string) =>
    new SlideFrontmatterInvalid({
      message: `slides/${id}.mdx has invalid frontmatter: ${reason}`,
      hint: "The frontmatter may hold only layout and notes. Run `fuse-deck describe` for the layouts.",
      id,
    });
  const [first] = tree.children;
  const yaml = first?.type === "yaml" ? first.value : "";
  return Result.gen(function* () {
    const raw = yield* parseYamlText(yaml).pipe(Result.mapError(invalid));
    const frontmatter = yield* decodeFrontmatter(raw ?? {}, {
      onExcessProperty: "error",
      errors: "all",
    }).pipe(Result.mapError((error) => invalid(error.message)));
    return {
      layout: frontmatter.layout ?? DEFAULT_LAYOUT,
      notes: Option.fromUndefinedOr(frontmatter.notes),
      title: firstHeading(tree),
    } satisfies SlideSource;
  });
}

/** The YAML's value, untyped until the frontmatter schema decodes it, or the parser's message. */
function parseYamlText(text: string): Result.Result<unknown, string> {
  try {
    return Result.succeed(parseYaml(text));
  } catch (error) {
    return Result.fail(error instanceof Error ? error.message : String(error));
  }
}

/** The text of the first heading in document order, at any depth, when it has any. */
function firstHeading(node: Nodes): Option.Option<string> {
  if (node.type === "heading") {
    const text = plainText(node).trim();
    return text === "" ? Option.none() : Option.some(text);
  }
  if (!("children" in node)) {
    return Option.none();
  }
  for (const child of node.children) {
    const heading = firstHeading(child);
    if (Option.isSome(heading)) {
      return heading;
    }
  }
  return Option.none();
}

/** A node's text as a reader sees it: text, inline code and image descriptions. */
function plainText(node: Nodes): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
      return node.value;
    case "image":
      return node.alt ?? "";
    default:
      return "children" in node ? node.children.map(plainText).join("") : "";
  }
}
