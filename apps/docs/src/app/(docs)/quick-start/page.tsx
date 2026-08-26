import type { ReactElement } from "react";

import { DocsPage, pageMetadata } from "../../../components/docs-page";

const HREF = "/quick-start";

export const metadata = pageMetadata(HREF);

const INSTALL = `pnpm add @elmeragroup/ui`;

const STYLES = `// app/layout.tsx — once, at the document root
import "@elmeragroup/ui/styles.css";
import "@elmeragroup/ui/themes.css";`;

const SCAFFOLD = `import { ColorSchemeScript, ElmeraGroupUiProvider, ThemeProvider } from "@elmeragroup/ui/theme";
import { defaultDensityForVariant, densityAttributes, themeAttributes } from "@elmeragroup/ui/theme";

const THEME = { variant: "external", brand: "fkas", segment: "private" } as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb-NO"
      {...themeAttributes(THEME)}
      {...densityAttributes(defaultDensityForVariant(THEME.variant))}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript storageKey="color-scheme" defaultColorScheme="system" enableSystem />
      </head>
      <body>
        <ThemeProvider theme={THEME} storageKey="color-scheme" injectColorSchemeScript={false}>
          <ElmeraGroupUiProvider locale="nb-NO">
            <a className="skip-link" href="#main">
              Hopp til innholdet
            </a>
            <header>{/* site header */}</header>
            <nav aria-label="Hovedmeny">{/* primary navigation */}</nav>
            <main id="main">{children}</main>
            <footer>{/* site footer */}</footer>
          </ElmeraGroupUiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}`;

const USAGE = `import { Button } from "@elmeragroup/ui/button";

export function SaveButton() {
  return <Button variant="primary">Lagre</Button>;
}`;

export default function QuickStartPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="install">Install</h2>
      <p>
        The library is a packaged dependency, not copy-paste source. <code>react</code> and{" "}
        <code>react-dom</code> are peers; every component lives behind its own subpath, so importing{" "}
        <code>Button</code> never pays for anything else.
      </p>
      <pre>
        <code>{INSTALL}</code>
      </pre>
      <p>Import the two stylesheets once, at the document root:</p>
      <pre>
        <code>{STYLES}</code>
      </pre>

      <h2 id="page-scaffold">The page scaffold</h2>
      <p>
        Page structure is the app&apos;s responsibility, not the library&apos;s: landmarks, heading order, the
        skip link and <code>lang</code> all live in your root layout. This is the expected scaffold — the docs
        show it once, here, and no component page repeats it.
      </p>
      <ul>
        <li>
          <strong>
            <code>lang</code>
          </strong>{" "}
          on <code>&lt;html&gt;</code>, matching the locale you pass the provider.
        </li>
        <li>
          <strong>Theme and density attributes</strong> on <code>&lt;html&gt;</code> so brand and density are
          correct before any JavaScript runs. Both density values are stamped explicitly, including{" "}
          <code>dense</code>.
        </li>
        <li>
          <strong>
            <code>ColorSchemeScript</code>
          </strong>{" "}
          in <code>&lt;head&gt;</code>, ahead of anything paintable, with{" "}
          <code>injectColorSchemeScript={"{false}"}</code> on the provider so the bootstrap is emitted once.
        </li>
        <li>
          <strong>A skip link</strong> as the first focusable element in <code>&lt;body&gt;</code>, targeting
          the <code>&lt;main&gt;</code> element&apos;s id.
        </li>
        <li>
          <strong>Landmarks</strong> — one <code>&lt;main&gt;</code>, labelled <code>&lt;nav&gt;</code>s, and
          a heading hierarchy that starts at <code>h1</code> and does not skip levels.
        </li>
      </ul>
      <pre>
        <code>{SCAFFOLD}</code>
      </pre>
      <p>
        Focus management across route changes is yours too: after a client-side navigation, move focus to the
        new page&apos;s heading or main landmark.
      </p>

      <h2 id="using-a-component">Using a component</h2>
      <p>
        Components read their colours from the theme in scope. Nothing in the snippet below names a brand —
        the attributes on <code>&lt;html&gt;</code> already decided that.
      </p>
      <pre>
        <code>{USAGE}</code>
      </pre>
    </DocsPage>
  );
}
