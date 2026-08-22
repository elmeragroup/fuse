"use client";

import type { ReactElement } from "react";

import { ThemeScope } from "@elmeragroup/ui/theme";

import type { TokenRef } from "../lib/docs-model";
import { usePreviewTheme } from "./PreviewTheme";
import "./TokensConsumed.css";

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
  const { theme } = usePreviewTheme();
  if (tokens.length === 0) {
    return null;
  }

  return (
    <section className="TokensConsumed" aria-labelledby={id}>
      <h2 id={id}>Tokens consumed</h2>
      <ThemeScope theme={theme} className="TokenList" render={<ul />}>
        {tokens.map((token) => (
          <li key={token.name} className="TokenItem">
            {token.isColor ? (
              <span className="TokenSwatch" style={{ background: `var(${token.name})` }} aria-hidden="true" />
            ) : (
              <span className="TokenSwatch TokenSwatchEmpty" aria-hidden="true" />
            )}
            <code>{token.name}</code>
          </li>
        ))}
      </ThemeScope>
    </section>
  );
}
