"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { ThemeScope } from "@elmeragroup/ui/theme";

import type { TokenRef } from "../lib/docs-model";
import { usePreviewTheme } from "./preview-theme";

export type TokenSwatchListProps = {
  tokens: readonly TokenRef[];
};

const tokenSwatchList = tv({
  slots: {
    list: "not-prose m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-4 gap-y-1.5 p-0",
    item: "flex min-w-0 items-center gap-2",
    itemCode: "text-xs overflow-hidden text-ellipsis whitespace-nowrap text-foreground",
    swatch: "size-[0.85rem] flex-none rounded-md border border-foreground/18 bg-(--swatch)",
    swatchEmpty: "docs-swatch-empty size-[0.85rem] flex-none rounded-md border border-foreground/18",
  },
});

const { list, item, itemCode, swatch, swatchEmpty } = tokenSwatchList();

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
    <ThemeScope theme={theme} className={list()} render={<ul />}>
      {tokens.map((token) => (
        <li key={token.name} className={item()}>
          {token.isColor ? (
            <span
              className={swatch()}
              data-token-swatch
              style={{ "--swatch": `var(${token.name})` }}
              aria-hidden="true"
            />
          ) : (
            <span className={swatchEmpty()} data-token-swatch aria-hidden="true" />
          )}
          <code className={itemCode()}>{token.name}</code>
        </li>
      ))}
    </ThemeScope>
  );
}
