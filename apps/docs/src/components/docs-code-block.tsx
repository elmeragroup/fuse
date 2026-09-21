import type { ComponentProps, ReactElement } from "react";

import { parse, render } from "sugar-high/core";
import { tokenize } from "sugar-high/lang/javascript";
import { tv } from "tailwind-variants";

const docsCodeBlock = tv({
  slots: {
    pre: "overflow-x-auto [tab-size:2] text-sh-identifier [&_.sh__line]:block [&_.sh__line]:min-h-[1lh]",
    code: "block",
  },
  variants: {
    variant: {
      // `standalone` has no live instance — no `page.mdx` authors a fenced block yet — and
      // inside `.prose.prose-sm` its inner `code` would compute 10.29px (12px × .857):
      // typography's `.prose-sm :where(code)` rule beats `.prose :where(pre code){font-size:
      // inherit}` on source order. `not-prose` removes the block and its subtree from prose
      // styling, so the `text-xs` on the `pre` is the whole type scale.
      standalone: {
        pre: "not-prose text-xs leading-relaxed my-[1.1rem] rounded-xl border border-border bg-card px-4 py-3.5",
        code: "min-w-max",
      },
      embedded: {
        pre: "text-xs leading-relaxed m-0 border-t border-border bg-card px-4.5 py-4",
        code: "min-w-max",
      },
      signature: {
        pre: "text-xs leading-relaxed m-0 rounded-lg border border-border bg-muted px-2.5 py-2",
        code: "wrap-anywhere whitespace-pre-wrap",
      },
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
 * Mirrors packages/fuse/src/components/code/code.tsx — delete both copies when sugar-high
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
 * cannot drift into three renderings. Tailwind preflight's `code, kbd, samp, pre` rule owns
 * the mono family for both elements, so neither slot restates it.
 */
export function DocsCodeBlock({
  className,
  variant = "standalone",
  source,
  ...props
}: DocsCodeBlockProps): ReactElement {
  const { pre, code } = docsCodeBlock({ variant });
  return (
    <pre className={pre({ className })} {...props}>
      <code className={code()} dangerouslySetInnerHTML={{ __html: highlight(source) }} />
    </pre>
  );
}
