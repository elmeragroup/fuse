import type { ComponentProps, ReactElement, Ref } from "react";

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
        pre: "text-xs leading-relaxed m-0 bg-card px-4.5 py-4",
        code: "min-w-max",
      },
      // Live code's source, whose 24px lines give every editable token a 24px target.
      live: {
        pre: "text-xs m-0 bg-card px-4.5 py-3 leading-6",
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

/** What a code block shows: raw text, or the highlighter's markup for it. */
export type DocsCodeContent = { readonly text: string } | { readonly html: string };

/** A `code` element its owner fills and edits itself through `codeRef`, as Live code does. */
type OwnedCode = "owned";

type DocsCodePreProps = Omit<ComponentProps<"pre">, "children"> & {
  /** The text, the markup the server highlighted, or `owned` for an element its owner fills. */
  code: DocsCodeContent | OwnedCode;
  /** The `code` element, for an owner that fills it. */
  codeRef?: Ref<HTMLElement>;
  /** MDX fence, demo-frame source region, Live code's source, or the API panel's full type signature. */
  variant?: "standalone" | "embedded" | "live" | "signature";
};

/**
 * The docs' `pre > code`, which `DocsCodeBlock` fills with highlighted markup on the server. It
 * reaches no highlighter, so a client component draws the same block around raw text, as the demo
 * frame does until its Code view shows. Tailwind preflight's `code, kbd, samp, pre` rule owns the
 * mono family for both elements, so neither slot restates it.
 */
export function DocsCodePre({
  className,
  variant = "standalone",
  code: content,
  codeRef,
  ...props
}: DocsCodePreProps): ReactElement {
  const { pre, code } = docsCodeBlock({ variant });
  return (
    <pre className={pre({ className })} {...props}>
      {content === "owned" ? (
        <code key="owned" ref={codeRef} className={code()} />
      ) : "html" in content ? (
        <code key="html" className={code()} dangerouslySetInnerHTML={{ __html: content.html }} />
      ) : (
        <code key="text" className={code()}>
          {content.text}
        </code>
      )}
    </pre>
  );
}
