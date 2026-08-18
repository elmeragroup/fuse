"use client";

import { createContext, useMemo } from "react";

import { themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeSlug } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

export type Theme = ThemeInput & { slug: ThemeSlug };

export const ThemeContext = createContext<Theme | undefined>(undefined);

export function useResolvedTheme(theme: ThemeInput): Theme {
  return useMemo((): Theme => {
    // theming.md §7.6: throw at the provider boundary, but only after this hook is registered.
    const validated = validateTheme(theme);
    const variant = validated.variant;
    const brand = validated.brand;
    const segment = validated.segment;
    const slug = themeSlug(validated);
    if (brand === "fkab") {
      return { variant, brand, segment: "company", slug };
    }
    if (brand === "fkse") {
      return { variant, brand, segment: "private", slug };
    }
    return { variant, brand, segment, slug };
  }, [theme]);
}
