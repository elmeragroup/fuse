"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactElement, ReactNode } from "react";

import {
  defaultDensityForVariant,
  densityAttributes,
  ElmeraGroupUiProvider,
  ThemeProvider,
  themeSlug,
} from "@elmeragroup/ui/theme";
import type { SupportedLocale, ThemeInput } from "@elmeragroup/ui/theme";

import { COLOR_SCHEME, DEFAULT_THEME, LEGAL_THEME_SLUGS, themeFromSlug } from "../lib/theme";

const LOCALES = ["nb-NO", "sv-SE", "en-US", "fi-FI"] as const satisfies readonly SupportedLocale[];

function isSupportedLocale(value: string): value is SupportedLocale {
  return LOCALES.some((locale) => locale === value);
}

export type ThemeHostProps = {
  children: ReactNode;
};

/**
 * The host side of the first-paint recipe (theming.md): one `ThemeProvider`, re-rendered
 * with a new `theme` prop when the switcher changes coordinate. The provider echoes the
 * brand attributes onto `<html>`; density is host-owned, so this component stamps
 * `data-density` for the variant the same way the server layout did for the default.
 */
export function ThemeHost({ children }: ThemeHostProps): ReactElement {
  const [theme, setTheme] = useState<ThemeInput>(DEFAULT_THEME);
  const [locale, setLocale] = useState<SupportedLocale>("nb-NO");
  const slug = useMemo(() => themeSlug(theme), [theme]);

  useEffect(() => {
    const density = densityAttributes(defaultDensityForVariant(theme.variant));
    document.documentElement.setAttribute("data-density", density["data-density"]);
  }, [theme.variant]);

  const handleThemeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = themeFromSlug(event.target.value);
    if (next !== null) {
      setTheme(next);
    }
  };

  const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    if (isSupportedLocale(event.target.value)) {
      setLocale(event.target.value);
    }
  };

  return (
    <ThemeProvider
      theme={theme}
      storageKey={COLOR_SCHEME.storageKey}
      defaultColorScheme={COLOR_SCHEME.defaultColorScheme}
      enableSystem={COLOR_SCHEME.enableSystem}
      injectColorSchemeScript={false}>
      <ElmeraGroupUiProvider locale={locale}>
        <header className="text-sm backdrop-blur sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-2">
          <span className="font-medium">elmera/ui playground</span>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">theme</span>
            <select
              className="text-xs rounded-md border border-border bg-card px-2 py-1 font-mono"
              value={slug}
              onChange={handleThemeChange}>
              {LEGAL_THEME_SLUGS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">locale</span>
            <select
              className="text-xs rounded-md border border-border bg-card px-2 py-1 font-mono"
              value={locale}
              onChange={handleLocaleChange}>
              {LOCALES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs ml-auto font-mono text-muted-foreground">
            density = {defaultDensityForVariant(theme.variant)}
          </span>
        </header>
        {children}
      </ElmeraGroupUiProvider>
    </ThemeProvider>
  );
}
