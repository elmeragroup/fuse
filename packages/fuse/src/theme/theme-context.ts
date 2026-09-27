"use client";

import { createContext, useMemo } from "react";

import { themeAxisDeps } from "./theme-axes";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeSlug } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

export type Theme = ThemeInput & { slug: ThemeSlug };

export const ThemeContext = createContext<Theme | undefined>(undefined);

type ResolvedThemeResult = { ok: true; theme: Theme } | { ok: false; error: Error };

/** Validates once per axis change. Never throws, so callers can register every hook first. */
export function useResolvedThemeResult(theme: ThemeInput): ResolvedThemeResult {
  const [variant, brand, segment] = themeAxisDeps(theme);
  return useMemo((): ResolvedThemeResult => {
    try {
      const validated = validateTheme(theme);
      // SAFETY: validateTheme already coerced pinned segments, so validated satisfies ThemeInput's
      // pin invariant; themeSlug returns the matching slug literal for that member.
      return { ok: true, theme: { ...validated, slug: themeSlug(validated) } as Theme };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- axis primitives are the equality key; equal inline theme literals must not revalidate
  }, [variant, brand, segment]);
}

export function useResolvedTheme(theme: ThemeInput): Theme {
  const result = useResolvedThemeResult(theme);
  // Throw at the provider boundary, but only after this hook is registered.
  if (!result.ok) throw result.error;
  return result.theme;
}
