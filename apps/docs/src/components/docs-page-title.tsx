import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { OVERVIEW_SECTION_ID } from "../lib/anchors";

const docsPageTitle = tv({
  base: "text-3xl font-semibold tracking-tight m-0 mb-[0.6rem] scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] font-heading",
});

type DocsPageTitleProps = ComponentProps<"h1">;

/**
 * The page H1. Title styles live here so the shell does not restyle every heading. Its default
 * id is the docs catalog's lead section, so `#overview` scrolls to the title on every page that
 * renders one. A page with its own id for the title, such as the error page, passes `id`.
 */
export function DocsPageTitle({ className, ...props }: DocsPageTitleProps): ReactElement {
  // oxlint-disable-next-line jsx-a11y/heading-has-content -- the heading's children arrive through props
  return <h1 id={OVERVIEW_SECTION_ID} className={docsPageTitle({ className })} {...props} />;
}
