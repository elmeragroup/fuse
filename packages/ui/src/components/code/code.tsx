import type { ComponentProps, ReactElement } from "react";

import { highlight } from "sugar-high";

import { cn } from "../../styles/cn";

export type CodeProps = Omit<ComponentProps<"pre">, "children"> & {
  /**
   * Raw source text, passed through `sugar-high`'s `highlight()`. Do not pass
   * pre-built HTML — `highlight()` HTML-escapes token text. The trust boundary
   * is the calling component, same as ordinary children.
   */
  code: string;
};

/**
 * Syntax-highlighted code block (code.md §2/§7/§8). Server component — it owns no
 * state, no handlers, and no browser APIs (performance.md §RSC classification).
 *
 * The inner `<code>` receives highlighter HTML via `dangerouslySetInnerHTML`. That
 * markup is `sugar-high` output over the caller-supplied `code` string;
 * `highlight()` escapes token text. Do not pass pre-built HTML.
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
