import type { ComponentProps, ReactElement } from "react";

import { parse, render } from "sugar-high/core";
import type { MarkLine, MarkToken } from "sugar-high/core";
import { tokenize } from "sugar-high/lang/javascript";

import type { Site } from "../lib/live-code/sites";
import { DocsCodePre } from "./docs-code-pre";

/**
 * The JavaScript/JSX highlighter, composed from sugar-high's granular entries. The
 * package root statically pulls every language preset; the docs render no `lang` axis,
 * so the JavaScript tokenizer is the whole requirement.
 *
 * The preset is called without parse-level overrides: its own defaults carry JSX, regex
 * and template scanning, and its packaged types do not accept `parse`'s options object.
 * Mirrors packages/fuse/src/components/code/code.tsx — delete both copies when sugar-high
 * fixes its tokenize types. The demo frame highlights here too, on the server, and hands the
 * markup to the client as a string.
 *
 * @param source - Raw source.
 * @returns sugar-high's markup for it.
 */
export function highlightSource(source: string): string {
  return render(parse(source, { tokenize: (code) => tokenize(code, undefined) }));
}

/**
 * What one marked range of a site is: its tag name, its type arguments, a spread, or one
 * attribute's name or value.
 */
type SiteMark = {
  readonly start: number;
  readonly end: number;
  readonly loc: string;
  /** The attribute's name, or `null` for the tag name, its type arguments and its spreads. */
  readonly prop: string | null;
  readonly role: "tag" | "type" | "spread" | "name" | "value";
};

function siteMarks(sites: readonly Site[]): readonly SiteMark[] {
  return sites.flatMap((site) => [
    { ...site.tag, loc: site.loc, prop: null, role: "tag" as const },
    ...(site.typeArguments === null
      ? []
      : [{ ...site.typeArguments, loc: site.loc, prop: null, role: "type" as const }]),
    ...site.spreads.map((spread) => ({ ...spread, loc: site.loc, prop: null, role: "spread" as const })),
    ...site.attributes.flatMap((attribute) => [
      {
        start: attribute.start,
        end: attribute.value?.start ?? attribute.end,
        loc: site.loc,
        prop: attribute.name,
        role: "name" as const,
      },
      ...(attribute.value === null
        ? []
        : [{ ...attribute.value, loc: site.loc, prop: attribute.name, role: "value" as const }]),
    ]),
  ]);
}

/**
 * Highlights a demo's source and marks the tokens of its Live code sites, so the Code view can
 * make them editable. Each token of a site's tag name carries `data-lens-site` and
 * `data-lens-role="tag"`, its type arguments carry the role `type` and its spreads `spread`. Each token of an attribute
 * adds `data-lens-prop`, with the role `name` for the name and its `=` and `value` for the value.
 * sugar-high hands `mark` its tokens without offsets, so this rebuilds them from the token values,
 * line by line. A token belongs to the innermost range it starts in, so a part written inside
 * another part's attribute, such as `render={<Button variant="outline" />}`, keeps its own marks.
 *
 * @param source - Raw source.
 * @param sites - Its sites, from `findSites` on the same text.
 * @returns sugar-high's markup with the site tokens marked.
 */
export function highlightLiveSource(source: string, sites: readonly Site[]): string {
  const marks = siteMarks(sites);
  const lineStarts: number[] = [0];
  for (let index = source.indexOf("\n"); index !== -1; index = source.indexOf("\n", index + 1)) {
    lineStarts.push(index + 1);
  }
  let at = 0;
  return render(parse(source, { tokenize: (code) => tokenize(code, undefined) }), {
    markLine(line: MarkLine) {
      at = lineStarts[line.index] ?? at;
    },
    mark(token: MarkToken) {
      const start = at;
      at += token.value.length;
      let range: SiteMark | undefined;
      for (const candidate of marks) {
        if (start < candidate.start || start >= candidate.end) continue;
        if (range === undefined || candidate.end - candidate.start < range.end - range.start)
          range = candidate;
      }
      if (range === undefined) return;
      token.properties["data-lens-site"] = range.loc;
      token.properties["data-lens-role"] = range.role;
      if (range.prop !== null) token.properties["data-lens-prop"] = range.prop;
    },
  });
}

type DocsCodeBlockProps = Omit<ComponentProps<"pre">, "children"> & {
  /** Raw source. Highlighted here, by the one highlighter the docs use. */
  source: string;
  /** MDX fence, demo-frame source region, or the API panel's full type signature. */
  variant?: "standalone" | "embedded" | "signature";
};

/**
 * The docs' one highlighted code renderer. MDX fences (`standalone`), the demo frame's
 * source region (`embedded`) and the API panel's full signature (`signature`) all hand over
 * raw source and get the same `pre > code` with sugar-high markup back, so highlighted code
 * cannot drift into three renderings.
 */
export function DocsCodeBlock({ source, ...props }: DocsCodeBlockProps): ReactElement {
  return <DocsCodePre {...props} code={{ html: highlightSource(source) }} />;
}
