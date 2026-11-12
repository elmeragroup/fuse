import type { ComponentProps, ReactElement } from "react";

import { parse, render } from "sugar-high/core";
import { tokenize } from "sugar-high/lang/javascript";

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
