/**
 * What the deck reads from a slide's MDX without compiling it: the frontmatter and the title.
 * The frontmatter holds only `layout` and `notes`; the title is the slide's first heading.
 */

import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { parse as parseYaml } from "yaml";

import type { SlideId } from "./slide-id.ts";
import { DEFAULT_LAYOUT, LAYOUT_NAMES } from "./vocabulary.ts";
import type { LayoutName } from "./vocabulary.ts";

/** A slide's frontmatter as the author writes it. */
const Frontmatter = Schema.Struct({
  layout: Schema.optionalKey(Schema.Literals(LAYOUT_NAMES)),
  notes: Schema.optionalKey(Schema.String),
});

const decodeFrontmatter = Schema.decodeUnknownResult(Frontmatter);

/** What the deck knows about a slide before it compiles it. */
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

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n?^---[ \t]*(?:\r?\n|$)/m;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;

/**
 * Parse a slide file.
 *
 * @param id - The slide, for the error.
 * @param text - The file's contents.
 * @returns What the deck reads from it, or `SlideFrontmatterInvalid`.
 */
export function parseSlideSource(
  id: SlideId,
  text: string
): Result.Result<SlideSource, SlideFrontmatterInvalid> {
  const invalid = (reason: string) =>
    new SlideFrontmatterInvalid({
      message: `slides/${id}.mdx has invalid frontmatter: ${reason}`,
      hint: "The frontmatter may hold only layout and notes. Run `fuse-deck describe` for the layouts.",
      id,
    });
  const block = text.startsWith("---") ? FRONTMATTER.exec(text) : null;
  const body = block === null ? text : text.slice(block[0].length);
  const yaml = block?.[1] ?? "";
  return Result.gen(function* () {
    const raw = yield* parseYamlText(yaml).pipe(Result.mapError(invalid));
    const frontmatter = yield* decodeFrontmatter(raw ?? {}, {
      onExcessProperty: "error",
      errors: "all",
    }).pipe(Result.mapError((error) => invalid(error.message)));
    return {
      layout: frontmatter.layout ?? DEFAULT_LAYOUT,
      notes: Option.fromUndefinedOr(frontmatter.notes),
      title: firstHeading(body),
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

/** The text of the first ATX heading outside a fenced code block. */
function firstHeading(body: string): Option.Option<string> {
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const opener = FENCE.exec(line)?.[1];
    if (opener !== undefined) {
      if (fence === null) {
        fence = opener;
      } else if (opener.startsWith(fence.charAt(0)) && opener.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      continue;
    }
    const heading = ATX_HEADING.exec(line)?.[1];
    if (heading !== undefined && heading !== "") {
      return Option.some(heading);
    }
  }
  return Option.none();
}
