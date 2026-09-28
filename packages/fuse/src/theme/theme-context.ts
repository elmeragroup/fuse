"use client";

import { createContext, useMemo } from "react";

import { attributesOfValidatedTheme } from "./theme-attributes";
import type { ThemeAttributes } from "./theme-attributes";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeSlug } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

export type Theme = ThemeInput & { slug: ThemeSlug };

export const ThemeContext = createContext<Theme | undefined>(undefined);

type ResolvedThemeResult =
  | { ok: true; theme: Theme; attributes: ThemeAttributes }
  | { ok: false; error: Error };

/**
 * Validates once per axis change and carries the validated theme's `data-theme-*` attributes,
 * so a production pinned-segment coercion warns once per axis change. Never throws, so callers
 * can register every hook first.
 */
export function useResolvedThemeResult(theme: ThemeInput): ResolvedThemeResult {
  // SAFETY: untyped CMS/env input is the boundary; optional axis reads keep memo deps from
  // throwing before remaining hooks register.
  const axes = theme as ThemeInput | null;
  return useMemo((): ResolvedThemeResult => {
    try {
      const validated = validateTheme(theme);
      return {
        ok: true,
        // SAFETY: validateTheme already coerced pinned segments, so validated satisfies ThemeInput's
        // pin invariant; themeSlug returns the matching slug literal for that member.
        theme: { ...validated, slug: themeSlug(validated) } as Theme,
        attributes: attributesOfValidatedTheme(validated),
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- axis primitives are the equality key; equal inline theme literals must not revalidate
  }, [axes?.variant, axes?.brand, axes?.segment]);
}

export function useResolvedTheme(theme: ThemeInput): Theme {
  const result = useResolvedThemeResult(theme);
  // Throw at the provider boundary, but only after this hook is registered.
  if (!result.ok) throw result.error;
  return result.theme;
}
