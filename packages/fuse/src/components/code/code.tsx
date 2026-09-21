import type { ComponentProps, ReactElement } from "react";

import { parse, render } from "sugar-high/core";
import { tokenize } from "sugar-high/lang/javascript";

import { cn } from "../../styles/cn";

/**
 * The JavaScript/JSX highlighter, composed from sugar-high's granular entries. The
 * package root would bundle every language preset; `Code` has no `lang` API, so the
 * JavaScript tokenizer is the whole requirement.
 *
 * The preset is called without parse-level overrides: its own defaults carry JSX, regex
 * and template scanning, and its packaged types do not accept `parse`'s options object.
 * Mirrors apps/docs/src/components/docs-code-block.tsx — delete both copies when
 * sugar-high fixes its tokenize types.
 */
function highlight(source: string): string {
  return render(parse(source, { tokenize: (code) => tokenize(code, undefined) }));
}

export type CodeProps = Omit<ComponentProps<"pre">, "children"> & {
  /**
   * Raw source text, highlighted by sugar-high's JavaScript tokenizer. Do not pass
   * pre-built HTML — the highlighter HTML-escapes token text. The trust boundary
   * is the calling component, same as ordinary children.
   */
  code: string;
};

/**
 * Syntax-highlighted code block. Server component — it owns no
 * state, no handlers, and no browser APIs (performance.md §RSC classification).
 *
 * The inner `<code>` receives highlighter HTML via `dangerouslySetInnerHTML`. That
 * markup is `sugar-high` output over the caller-supplied `code` string;
 * the highlighter escapes token text. Do not pass pre-built HTML.
 */
export function Code({ className, code, ...props }: CodeProps): ReactElement {
  return (
    <pre
      data-slot="code"
      tabIndex={0}
      role="region"
      className={cn("text-xs leading-relaxed max-h-160 overflow-auto font-mono", className)}
      {...props}>
      <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
    </pre>
  );
}

Code.displayName = "Code";
