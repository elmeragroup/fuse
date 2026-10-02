"use client";

import { createContext, useMemo } from "react";

import { attributesOfValidatedTheme } from "./theme-attributes";
import type { ThemeAttributes } from "./theme-attributes";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeSlug } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

export type Theme = ThemeInput & { slug: ThemeSlug };

export const ThemeContext = createContext<Theme | undefined>(undefined);

/** A validated theme and the `data-theme-*` attributes that stamp it. */
type ResolvedTheme = { theme: Theme; attributes: ThemeAttributes };

/**
 * Resolves a theme input once per axis change, so a production pinned-segment coercion warns
 * once per axis change and equal inline theme literals keep their identity. An invalid theme
 * throws its validation error at the calling boundary; a caller that has more hooks renders
 * them in a child component, so the throw never changes its hook order.
 *
 * @param theme - The untyped host theme input.
 * @returns The validated theme and its attributes.
 * @throws The validation error for an invalid theme.
 */
export function useResolvedTheme(theme: ThemeInput): ResolvedTheme {
  // SAFETY: untyped CMS/env input is the boundary; optional axis reads keep memo deps from
  // throwing before the memo can validate and report the real error.
  const axes = theme as ThemeInput | null;
  return useMemo((): ResolvedTheme => {
    const validated = validateTheme(theme);
    return {
      // SAFETY: validateTheme already coerced pinned segments, so validated satisfies ThemeInput's
      // pin invariant; themeSlug returns the matching slug literal for that member.
      theme: { ...validated, slug: themeSlug(validated) } as Theme,
      attributes: attributesOfValidatedTheme(validated),
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- axis primitives are the equality key; equal inline theme literals must not revalidate
  }, [axes?.variant, axes?.brand, axes?.segment]);
}
