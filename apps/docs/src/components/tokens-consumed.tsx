import type { ReactElement } from "react";

import type { TokenRef } from "../lib/docs-model";
import { DocsSectionHeading } from "./docs-section-heading";
import { TokenSwatchList } from "./token-swatch-list";

export type TokensConsumedProps = {
  id: string;
  tokens: readonly TokenRef[];
};

/**
 * The generated Tokens-consumed section: every custom property the
 * component's recipe reads, collected statically at docs build. Colour swatches render
 * inside a `ThemeScope` on the preview theme, so a swatch shows the value the demo
 * stages above are actually painting with.
 */
export function TokensConsumed({ id, tokens }: TokensConsumedProps): ReactElement | null {
  if (tokens.length === 0) {
    return null;
  }

  return (
    <section className="mt-8" aria-labelledby={id}>
      <DocsSectionHeading id={id}>Tokens consumed</DocsSectionHeading>
      <TokenSwatchList tokens={tokens} />
    </section>
  );
}
