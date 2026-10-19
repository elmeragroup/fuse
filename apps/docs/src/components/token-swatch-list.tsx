"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { ThemeScope } from "@elmeragroup/fuse/theme";

import type { TokenRef } from "../lib/docs-model";
import { usePreviewTheme } from "./preview-theme";

type TokenSwatchListProps = {
  tokens: readonly TokenRef[];
};

const tokenSwatchList = tv({
  slots: {
    list: "not-prose m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-4 gap-y-1.5 p-0",
    item: "flex min-w-0 items-center gap-2",
    itemText: "flex min-w-0 flex-col gap-0.5",
    itemCode: "text-xs overflow-hidden text-ellipsis whitespace-nowrap text-foreground",
    itemDescription: "text-xs text-muted-foreground",
    swatch: "size-[0.85rem] flex-none rounded-md border border-foreground/18",
    // The empty-swatch hatch has no scale neighbour; `.oxlintrc.json` allows its
    // off-scale gradient for this file instead of declaring a CSS utility.
    swatchEmpty:
      "size-[0.85rem] flex-none rounded-md border border-foreground/18 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,color-mix(in_oklab,var(--foreground)_14%,transparent)_3px,color-mix(in_oklab,var(--foreground)_14%,transparent)_6px)]",
  },
  variants: {
    // A described list gives each token room for its sentence and sets the swatch beside the
    // name's line rather than the middle of the text.
    described: {
      true: {
        list: "grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-6 gap-y-3",
        item: "items-start",
        swatch: "mt-0.5",
      },
    },
  },
});

/**
 * The one way this site lists custom properties: a swatch beside the token name, and below the
 * name the token's description when the list carries one, as the tokens handbook page does.
 *
 * The list renders inside a `ThemeScope` on the preview theme, so every swatch paints
 * the value the currently selected theme resolves — the same list the Tokens-consumed
 * section and the handbook's token reference both show.
 */
export function TokenSwatchList({ tokens }: TokenSwatchListProps): ReactElement {
  const { theme } = usePreviewTheme();
  const described = tokens.some((token) => token.description !== undefined);
  const { list, item, itemText, itemCode, itemDescription, swatch, swatchEmpty } = tokenSwatchList({
    described,
  });

  return (
    <ThemeScope theme={theme} className={list()} render={<ul />}>
      {tokens.map((token) => (
        <li key={token.name} className={item()}>
          {token.isColor ? (
            <span
              className={swatch()}
              data-token-swatch
              style={{ backgroundColor: `var(${token.name})` }}
              aria-hidden="true"
            />
          ) : (
            <span className={swatchEmpty()} data-token-swatch aria-hidden="true" />
          )}
          <span className={itemText()}>
            <code className={itemCode()}>{token.name}</code>
            {token.description === undefined ? null : (
              <span className={itemDescription()} data-token-description>
                {token.description}
              </span>
            )}
          </span>
        </li>
      ))}
    </ThemeScope>
  );
}
