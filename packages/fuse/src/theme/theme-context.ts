"use client";

import { createContext, useMemo } from "react";

import { themeAxisDeps } from "./theme-axes";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeSlug } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

export type Theme = ThemeInput & { slug: ThemeSlug };

export const ThemeContext = createContext<Theme | undefined>(undefined);

export function useResolvedTheme(theme: ThemeInput): Theme {
  const [variant, brand, segment] = themeAxisDeps(theme);
  return useMemo((): Theme => {
    // Throw at the provider boundary, but only after this hook is registered.
    const validated = validateTheme(theme);
    // SAFETY: validateTheme already coerced pinned segments, so validated satisfies ThemeInput's
    // pin invariant; themeSlug returns the matching slug literal for that member.
    return { ...validated, slug: themeSlug(validated) } as Theme;
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- axis primitives are the equality key; equal inline theme literals must not revalidate
  }, [variant, brand, segment]);
}
