"use client";

import { use, useInsertionEffect, useRef } from "react";
import type { ReactNode } from "react";

import { DocumentWriterContext, echoDocumentBrandAttributes } from "./document-writer";
import { themeAttributes } from "./theme-attributes";
import { ThemeContext, useResolvedTheme } from "./theme-context";
import type { Theme } from "./theme-context";
import type { ThemeInput } from "./tokens/themes";

export type ThemeProviderProps = {
  theme: ThemeInput;
  children: ReactNode;
};

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const hasDocumentWriter = use(DocumentWriterContext);
  if (hasDocumentWriter) {
    return children;
  }
  return <DocumentThemeWriter theme={theme}>{children}</DocumentThemeWriter>;
}

function DocumentThemeWriter({ theme, children }: ThemeProviderProps) {
  const diagnosed = useRef(false);

  useInsertionEffect(() => {
    const attributes = themeAttributes(theme);
    const shouldDiagnose = !diagnosed.current;
    diagnosed.current = true;
    // Insertion runs before descendant useLayoutEffect so children never measure stale brand.
    echoDocumentBrandAttributes(attributes, shouldDiagnose);
  }, [theme]);

  const value = useResolvedTheme(theme);

  return (
    <DocumentWriterContext.Provider value={true}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </DocumentWriterContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (theme === undefined) {
    throw new Error("useTheme must be used within ThemeProvider or ThemeScope");
  }
  return theme;
}
