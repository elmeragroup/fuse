"use client";

import { use } from "react";
import type { ReactNode } from "react";

import type { ColorSchemeOptions, ColorSchemeScriptElementProps } from "./color-scheme";
import { ColorSchemeRoot } from "./color-scheme-root";
import { DocumentWriterContext, useDocumentBrand } from "./document-brand";
import type { ThemeAttributes } from "./theme-attributes";
import { ThemeContext, useResolvedTheme } from "./theme-context";
import type { Theme } from "./theme-context";
import type { ThemeInput } from "./tokens/themes";

export type ThemeProviderProps = ColorSchemeOptions & {
  theme: ThemeInput;
  children: ReactNode;
  disableTransitionOnChange?: boolean;
  injectColorSchemeScript?: boolean;
  nonce?: string;
  scriptProps?: ColorSchemeScriptElementProps;
};

export function ThemeProvider(props: ThemeProviderProps) {
  const hasDocumentWriter = use(DocumentWriterContext);
  if (hasDocumentWriter) {
    return <NestedThemeValidator theme={props.theme}>{props.children}</NestedThemeValidator>;
  }
  return <DocumentThemeWriter {...props} />;
}

// Nested providers never fork the document writer; they only validate their own theme.
// useResolvedTheme memoizes on axis primitives so a production coercion warns once per
// illegal theme, not on every re-render.
function NestedThemeValidator({ theme, children }: { theme: ThemeInput; children: ReactNode }) {
  useResolvedTheme(theme);
  return children;
}

// The throw for an invalid theme directly follows the one hook it depends on; everything the
// writer does with a valid theme lives in DocumentBrandWriter and ColorSchemeRoot below.
function DocumentThemeWriter({ theme, children, ...colorScheme }: ThemeProviderProps) {
  const resolved = useResolvedTheme(theme);
  return (
    <DocumentBrandWriter theme={resolved.theme} attributes={resolved.attributes}>
      <ColorSchemeRoot {...colorScheme}>{children}</ColorSchemeRoot>
    </DocumentBrandWriter>
  );
}

function DocumentBrandWriter({
  theme,
  attributes,
  children,
}: {
  theme: Theme;
  attributes: ThemeAttributes;
  children: ReactNode;
}) {
  useDocumentBrand(attributes);

  return (
    <DocumentWriterContext.Provider value={true}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
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
