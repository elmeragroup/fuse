import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { SCROLLER_FOCUS_RING } from "./scroller-focus-ring";

const docsCodeBlock = tv({
  slots: {
    pre: "[tab-size:2] text-sh-identifier [&_.sh__line]:block [&_.sh__line]:min-h-[1lh]",
    code: "block",
  },
  variants: {
    scrolls: {
      // The code keeps its longest line whole, so that line scrolls the block.
      true: {
        pre: ["overflow-x-auto", SCROLLER_FOCUS_RING],
        code: "min-w-max",
      },
    },
    variant: {
      // Inside `.prose.prose-sm`, a `standalone` block's inner `code` would compute 10.29px
      // (12px × .857): typography's `.prose-sm :where(code)` rule beats `.prose :where(pre code)
      // {font-size:inherit}` on source order. `not-prose` removes the block and its subtree from
      // prose styling, so the `text-xs` on the `pre` is the whole type scale.
      standalone: {
        pre: "not-prose text-xs leading-relaxed my-[1.1rem] rounded-xl border border-border bg-card px-4 py-3.5",
      },
      embedded: {
        pre: "text-xs leading-relaxed m-0 bg-card px-4.5 py-4",
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

/** What a code block shows: raw text, or the highlighter's markup for it. */
export type DocsCodeContent = { readonly text: string } | { readonly html: string };

type DocsCodePreProps = Omit<ComponentProps<"pre">, "children"> & {
  /** The text, or the markup the server highlighted. */
  code: DocsCodeContent;
  /** MDX fence, demo-frame source region, or the API panel's full type signature. */
  variant?: "standalone" | "embedded" | "signature";
};

/**
 * The docs' `pre > code`. It renders plain text or the highlighted HTML `DocsCodeBlock` makes on
 * the server, without importing the highlighter, so a client component can draw the same block
 * around raw text, as the demo frame does until its Code view shows. Tailwind
 * preflight's `code, kbd, samp, pre` rule owns the mono family for both elements, so neither slot
 * restates it.
 */
export function DocsCodePre({
  className,
  variant = "standalone",
  code: content,
  ...props
}: DocsCodePreProps): ReactElement {
  // A wrapped signature never scrolls, so it stays out of the tab order.
  const scrolls = variant !== "signature";
  const { pre, code } = docsCodeBlock({ variant, scrolls });
  const scrollStop: Pick<ComponentProps<"pre">, "tabIndex" | "role" | "aria-label"> = {};
  if (scrolls) {
    // A long line scrolls the block sideways, so the block is a tab stop that arrow keys scroll.
    // It takes `group` rather than `region` because a page holds dozens of blocks, and each
    // region would be another landmark.
    scrollStop.tabIndex = 0;
    scrollStop.role = "group";
    scrollStop["aria-label"] = "Code";
  }
  return (
    <pre {...scrollStop} className={pre({ className })} {...props}>
      {"html" in content ? (
        <code key="html" className={code()} dangerouslySetInnerHTML={{ __html: content.html }} />
      ) : (
        <code key="text" className={code()}>
          {content.text}
        </code>
      )}
    </pre>
  );
}
