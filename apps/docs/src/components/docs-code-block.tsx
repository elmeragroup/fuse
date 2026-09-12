import type { ComponentProps, ReactElement } from "react";

import { parse, render } from "sugar-high/core";
import { tokenize } from "sugar-high/lang/javascript";
import { tv } from "tailwind-variants";

const docsCodeBlock = tv({
  base: "font-docs-mono overflow-x-auto [tab-size:2] text-[var(--sh-identifier,var(--color-docs-ink))] [&_.sh__line]:block [&_.sh__line]:min-h-[1lh] [&_code]:block [&_code]:border-0 [&_code]:p-0 [&_code]:[background:none] [&_code]:[font:inherit]",
  variants: {
    variant: {
      standalone:
        "bg-docs-code border-docs-line my-[1.1rem] rounded-[8px] border p-[0.9rem_1rem] text-[12px] leading-[1.65] [&_code]:min-w-max",
      embedded:
        "bg-docs-code border-docs-line m-0 border-t p-[1rem_1.1rem] text-[12px] leading-[1.65] [&_code]:min-w-max",
      signature:
        "bg-docs-soft border-docs-line m-0 rounded-[6px] border px-[0.6rem] py-2 text-[11.5px] leading-[1.6] [&_code]:wrap-anywhere [&_code]:whitespace-pre-wrap",
    },
  },
  defaultVariants: {
    variant: "standalone",
  },
});

/**
 * The JavaScript/JSX highlighter, composed from sugar-high's granular entries. The
 * package root statically pulls every language preset; the docs render no `lang` axis,
 * so the JavaScript tokenizer is the whole requirement.
 *
 * The preset is called without parse-level overrides: its own defaults carry JSX, regex
 * and template scanning, and its packaged types do not accept `parse`'s options object.
 * Mirrors packages/ui/src/components/code/code.tsx — delete both copies when sugar-high
 * fixes its tokenize types.
 */
function highlight(source: string): string {
  return render(parse(source, { tokenize: (code) => tokenize(code, undefined) }));
}

export type DocsCodeBlockProps = Omit<ComponentProps<"pre">, "children"> & {
  /** Raw source. Highlighted here, by the one highlighter the docs use (docs-site.md §8). */
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
export function DocsCodeBlock({
  className,
  variant = "standalone",
  source,
  ...props
}: DocsCodeBlockProps): ReactElement {
  return (
    <pre className={docsCodeBlock({ variant, className })} {...props}>
      <code dangerouslySetInnerHTML={{ __html: highlight(source) }} />
    </pre>
  );
}
