"use client";

import type { CSSProperties, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { ThemeScope } from "@elmeragroup/ui/theme";

import type { TokenRef } from "../lib/docs-model";
import { usePreviewTheme } from "./preview-theme";

export type TokenSwatchListProps = {
  tokens: readonly TokenRef[];
};

const tokenSwatchList = tv({
  slots: {
    list: "not-prose m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-[0.35rem_1rem] p-0",
    item: "[&_code]:text-xs flex min-w-0 items-center gap-2 [&_code]:overflow-hidden [&_code]:font-mono [&_code]:text-ellipsis [&_code]:whitespace-nowrap [&_code]:text-foreground",
    swatch: "size-[0.85rem] flex-none rounded-md border border-foreground/18 bg-(--swatch)",
    swatchEmpty:
      "size-[0.85rem] flex-none rounded-md border border-foreground/18 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,color-mix(in_oklab,var(--foreground)_14%,transparent)_3px,color-mix(in_oklab,var(--foreground)_14%,transparent)_6px)]",
  },
});

const { list, item, swatch, swatchEmpty } = tokenSwatchList();

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
              // SAFETY: `CSSProperties` has no index signature for custom properties, and React
              // passes an unknown `--*` key straight through to the inline style attribute.
              style={{ "--swatch": `var(${token.name})` } as CSSProperties}
              aria-hidden="true"
            />
          ) : (
            <span className={swatchEmpty()} data-token-swatch aria-hidden="true" />
          )}
          <code>{token.name}</code>
        </li>
      ))}
    </ThemeScope>
  );
}
