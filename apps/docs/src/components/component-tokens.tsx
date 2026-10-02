import type { ReactElement } from "react";

import { requireComponent } from "../lib/component-page";
import { TOKENS_SECTION_ID } from "../lib/nav";
import { DocsSectionHeading } from "./docs-section-heading";
import { TokenSwatchList } from "./token-swatch-list";

type ComponentTokensProps = {
  slug: string;
};

/**
 * The generated Tokens-consumed section of a component page: every custom property the
 * component's recipe reads, collected statically at docs build. The page names the slug;
 * the token list itself is never hand-authored. Colour swatches render inside a
 * `ThemeScope` on the preview theme, so a swatch shows the value the demo stages above are
 * actually painting with.
 */
export function ComponentTokens({ slug }: ComponentTokensProps): ReactElement | null {
  const { tokens } = requireComponent(slug);
  if (tokens.length === 0) {
    return null;
  }

  return (
    <section className="mt-8" aria-labelledby={TOKENS_SECTION_ID}>
      <DocsSectionHeading id={TOKENS_SECTION_ID}>Tokens consumed</DocsSectionHeading>
      <TokenSwatchList tokens={tokens} />
    </section>
  );
}
