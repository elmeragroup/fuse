"use client";

import type { ReactElement } from "react";

import type { TokenRef } from "../lib/docs-model";
import "./TokensConsumed.css";
import { TokenSwatchList } from "./TokenSwatchList";

export type TokensConsumedProps = {
  id: string;
  tokens: readonly TokenRef[];
};

/**
 * The generated Tokens-consumed section (docs-site.md §3.4): every custom property the
 * component's recipe reads, collected statically at docs build. Colour swatches render
 * inside a `ThemeScope` on the preview theme, so a swatch shows the value the demo
 * stages above are actually painting with.
 */
export function TokensConsumed({ id, tokens }: TokensConsumedProps): ReactElement | null {
  if (tokens.length === 0) {
    return null;
  }

  return (
    <section className="TokensConsumed" aria-labelledby={id}>
      <h2 id={id}>Tokens consumed</h2>
      <TokenSwatchList tokens={tokens} />
    </section>
  );
}
