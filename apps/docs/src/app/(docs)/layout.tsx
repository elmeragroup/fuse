import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { ColorSchemeScript, ThemeProvider } from "@elmeragroup/ui/theme";

import { DocsShell } from "../../components/docs-shell";
import { DocumentRoot } from "../../components/document-root";
import { SkipNav } from "../../components/skip-nav";
import { DOCUMENT_COLOR_SCHEME, DOCUMENT_THEME } from "../../lib/theme";
import "../../styles/globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s · elmera/ui",
    default: "elmera/ui",
  },
};

export type DocsLayoutProps = {
  children: ReactNode;
};

export default function DocsLayout({ children }: DocsLayoutProps): ReactElement {
  return (
    <DocumentRoot suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={DOCUMENT_COLOR_SCHEME.storageKey}
          defaultColorScheme={DOCUMENT_COLOR_SCHEME.defaultColorScheme}
          enableSystem={DOCUMENT_COLOR_SCHEME.enableSystem}
        />
      </head>
      <body className="font-docs-sans text-docs-ink m-0 min-w-80 bg-background antialiased">
        <ThemeProvider
          theme={DOCUMENT_THEME}
          storageKey={DOCUMENT_COLOR_SCHEME.storageKey}
          defaultColorScheme={DOCUMENT_COLOR_SCHEME.defaultColorScheme}
          enableSystem={DOCUMENT_COLOR_SCHEME.enableSystem}
          injectColorSchemeScript={false}>
          <SkipNav />
          <DocsShell>{children}</DocsShell>
        </ThemeProvider>
      </body>
    </DocumentRoot>
  );
}
