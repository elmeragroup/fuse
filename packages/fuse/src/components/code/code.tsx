import type { ComponentProps, ReactElement } from "react";

import { parse, render } from "sugar-high/core";
import { tokenize } from "sugar-high/lang/javascript";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";

/**
 * The JavaScript and JSX highlighter, built from sugar-high's granular entries. The package root
 * would bundle every language preset, and `Code` has no `lang` prop, so it needs only the
 * JavaScript tokenizer.
 *
 * The preset runs without parse-level overrides. Its own defaults scan JSX, regular expressions
 * and template literals, and its packaged types do not accept `parse`'s options object. The same
 * function is in apps/docs/src/components/docs-code-block.tsx. Delete both copies when
 * sugar-high fixes its tokenize types.
 */
function highlight(source: string): string {
  return render(parse(source, { tokenize: (code) => tokenize(code, undefined) }));
}

/** `Code` takes a native `pre` element's props, without `children`, plus the source text. */
export type CodeProps = Omit<ComponentProps<"pre">, "children" | "aria-label"> & {
  /**
   * The source text, highlighted as JavaScript and JSX. Pass raw text, not HTML. The highlighter
   * escapes it, so markup shows as text.
   */
  code: string;
  /**
   * Names the block. A block named here or through `aria-labelledby` is a `region` landmark. An
   * unnamed block has no role. The block is always a tab stop, so a keyboard user can scroll it.
   */
  "aria-label"?: ComponentProps<"pre">["aria-label"];
};

/**
 * A syntax-highlighted code block. The inner `<code>` receives sugar-high's HTML through
 * `dangerouslySetInnerHTML`, built from the `code` string with its token text escaped.
 */
export function Code({ className, code, ...props }: CodeProps): ReactElement {
  return (
    <pre
      data-slot="code"
      tabIndex={0}
      {...definedProps({
        role:
          props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined ? "region" : undefined,
      })}
      className={cn("text-xs leading-relaxed max-h-160 overflow-auto font-mono", className)}
      {...props}>
      <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
    </pre>
  );
}

Code.displayName = "Code";
