import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { ColorSchemeScript, ThemeProvider } from "@elmeragroup/ui/theme";

import { DocsShell } from "../../components/DocsShell";
import { DocumentRoot } from "../../components/DocumentRoot";
import { SkipNav } from "../../components/SkipNav";
import { DOCUMENT_COLOR_SCHEME, DOCUMENT_THEME } from "../../lib/theme";
import "../../styles/globals.css";
import "./layout.css";

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
      <body>
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
