import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";

const HREF = "/handbook/density";

export const metadata = pageMetadata(HREF);

const ONE_DOCUMENT = `import { documentAttributes } from "@elmeragroup/fuse/theme";

<html {...documentAttributes({ theme, density: "dense" })}>`;

const ROUTE_GROUPS = `app/
  (dashboard)/
    layout.tsx        // <html data-density="dense">
    accounts/page.tsx
    invoices/page.tsx
  (promo)/
    layout.tsx        // <html data-density="comfortable">
    page.tsx
    offers/page.tsx
  global-not-found.tsx
  global-error.tsx`;

const SHARED_THEME = `// lib/theme.ts
export const THEME = { identity: "branded", brand: "fkas", segment: "private" } as const;

export const COLOR_SCHEME = {
  storageKey: "color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
} as const;`;

const DASHBOARD_LAYOUT = `// app/(dashboard)/layout.tsx: a branded customer dashboard, dense
import { ColorSchemeScript, documentAttributes, ThemeProvider } from "@elmeragroup/fuse/theme";
import { COLOR_SCHEME, THEME } from "../../lib/theme";
import "../globals.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb-NO" {...documentAttributes({ theme: THEME, density: "dense" })} suppressHydrationWarning>
      <head>
        <ColorSchemeScript {...COLOR_SCHEME} />
      </head>
      <body>
        <ThemeProvider theme={THEME} {...COLOR_SCHEME}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}`;

const PROMO_LAYOUT = `// app/(promo)/layout.tsx: the same brand's promo pages, comfortable
import { ColorSchemeScript, documentAttributes, ThemeProvider } from "@elmeragroup/fuse/theme";
import { COLOR_SCHEME, THEME } from "../../lib/theme";
import "../globals.css";

export default function PromoLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb-NO"
      {...documentAttributes({ theme: THEME, density: "comfortable" })}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript {...COLOR_SCHEME} />
      </head>
      <body>
        <ThemeProvider theme={THEME} {...COLOR_SCHEME}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}`;

const GLOBAL_NOT_FOUND = `// app/global-not-found.tsx: renders its own <html>, outside both root layouts
import { documentAttributes, ThemeProvider } from "@elmeragroup/fuse/theme";
import { THEME } from "../lib/theme";
import "./globals.css";

export default function GlobalNotFound() {
  return (
    <html lang="nb-NO" {...documentAttributes({ theme: THEME, density: "comfortable" })}>
      <body>
        <ThemeProvider theme={THEME}>
          <h1>Fant ikke siden</h1>
        </ThemeProvider>
      </body>
    </html>
  );
}`;

const BRANDED_DASHBOARD = `// app/(dashboard)/accounts/page.tsx: brand colours, type and corners at dense metrics
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Table } from "@elmeragroup/fuse/table";

export default function AccountsPage() {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Målepunkter</Card.Title>
      </Card.Header>
      <Card.Content>
        <Table.Root>{/* dense rows: --row-h and --row-px at their dense values */}</Table.Root>
      </Card.Content>
      <Card.Footer>
        {/* A branded pill keeps 12px label padding at dense density. */}
        <Button>Last ned faktura</Button>
      </Card.Footer>
    </Card.Root>
  );
}`;

export default function DensityPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="per-document">One density per document</h2>
      <p>
        Density sets the control, row, surface and label metrics: how tall a control is, how far a row and a
        card pad their content, and the size of a label. It has two values, <code>dense</code> and{" "}
        <code>comfortable</code>, and it belongs to the document, not to the theme. The document root carries
        it as <code>data-density</code>, and <code>documentAttributes</code> stamps it there with the theme,
        so a page names its density every time:
      </p>
      <pre>
        <code>{ONE_DOCUMENT}</code>
      </pre>
      <p>
        No identity implies a density. A neutral internal tool is usually dense and a branded marketing page
        comfortable, but a branded customer dashboard is dense too, with the brand&apos;s colours, type and
        corners at the dense metrics. A <code>ThemeScope</code> re-themes a subtree but never changes its
        density, and neither <code>ThemeProvider</code> nor <code>ThemeScope</code> writes{" "}
        <code>data-density</code>. The metrics follow the document, so one page renders at one density.
      </p>

      <h2 id="route-groups">A dense dashboard and comfortable promo pages</h2>
      <p>
        An app that needs both densities gives each its own document. In the Next App Router, put each density
        in its own route group with its own root layout. Each layout renders its own <code>&lt;html&gt;</code>{" "}
        and stamps its density there:
      </p>
      <pre>
        <code>{ROUTE_GROUPS}</code>
      </pre>
      <p>Share the theme and the colour-scheme options through one module, so both documents agree:</p>
      <pre>
        <code>{SHARED_THEME}</code>
      </pre>
      <pre>
        <code>{DASHBOARD_LAYOUT}</code>
      </pre>
      <pre>
        <code>{PROMO_LAYOUT}</code>
      </pre>

      <h2 id="pitfalls">Pitfalls</h2>
      <ul>
        <li>
          <strong>A full reload between root layouts.</strong> Next cannot swap one root layout for another in
          place, so a link from a dashboard page to a promo page reloads the whole page. Keep the pages a
          visitor moves between often in one group.
        </li>
        <li>
          <strong>
            <code>global-not-found</code> and <code>global-error</code> render their own{" "}
            <code>&lt;html&gt;</code>.
          </strong>{" "}
          They sit outside every root layout, so they get neither density nor theme from one. Stamp the
          attributes on their <code>&lt;html&gt;</code> themselves, at the density you want those pages to
          have.
        </li>
        <li>
          <strong>Parallel and intercepted routes stay in one document.</strong> A slot such as{" "}
          <code>@modal</code> and an intercepted route such as <code>(.)photo</code> render inside the root
          layout of the page that shows them, so they take its density. They cannot switch density: a
          comfortable modal over a dense dashboard needs its own page.
        </li>
      </ul>
      <pre>
        <code>{GLOBAL_NOT_FOUND}</code>
      </pre>

      <h2 id="branded-dashboard">A branded dashboard</h2>
      <p>
        The dashboard group above wears the branded theme at dense density. Its pages need nothing of their
        own: every part reads the dense metrics from the document and the brand&apos;s roles from the theme. A
        branded button keeps at least 12px of padding on its label edges at dense density, so a pill does not
        crowd its label.
      </p>
      <pre>
        <code>{BRANDED_DASHBOARD}</code>
      </pre>
      <p>
        See <Link href="/handbook/theming#document-theme">The document theme</Link> for the rest of the
        document setup and <Link href="/handbook/tokens">Tokens</Link> for every density metric at both
        densities.
      </p>
    </DocsPage>
  );
}
