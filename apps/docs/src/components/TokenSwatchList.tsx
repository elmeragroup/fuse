"use client";

import type { ReactElement } from "react";

import { ThemeScope } from "@elmeragroup/ui/theme";

import type { TokenRef } from "../lib/docs-model";
import { usePreviewTheme } from "./PreviewTheme";
import "./TokenSwatchList.css";

export type TokenSwatchListProps = {
  tokens: readonly TokenRef[];
};

/**
 * The one way this site lists custom properties: a swatch beside the token name.
 *
 * The list renders inside a `ThemeScope` on the preview theme, so every swatch paints
 * the value the currently selected theme resolves — the same list the Tokens-consumed
 * section and the handbook's token reference both show.
 */
export function TokenSwatchList({ tokens }: TokenSwatchListProps): ReactElement {
  const { theme } = usePreviewTheme();

  return (
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
  );
}
