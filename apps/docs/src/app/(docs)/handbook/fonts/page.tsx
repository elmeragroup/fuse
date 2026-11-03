import type { ReactElement } from "react";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { DocsTable } from "../../../../components/docs-table";

const HREF = "/handbook/fonts";

export const metadata = pageMetadata(HREF);

const NEXT_FONTS = `// app/fonts.ts
import { Inter } from "next/font/google";
import localFont from "next/font/local";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

// A licensed face, from files your app holds.
export const neoSans = localFont({
  src: [
    { path: "./fonts/NeoSans-Medium.woff2", weight: "500" },
    { path: "./fonts/NeoSans-Bold.woff2", weight: "700" },
  ],
  variable: "--font-neo-sans",
});`;

const NEXT_LAYOUT = `// app/layout.tsx
import { inter, neoSans } from "./fonts";

<html lang="nb" className={\`\${inter.variable} \${neoSans.variable}\`} {...themeAttributes(theme)}>
  <body className="font-sans">{children}</body>
</html>;`;

const NEXT_CSS = `:root {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}`;

const FONTSOURCE = `// The module that renders <html>.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";`;

const FONTSOURCE_CSS = `:root {
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}`;

const FONT_FACE = `@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-latin-400.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* The same for 500, 600 and 700. */

:root {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}`;

const PER_BRAND = `[data-theme-brand="fkas"] {
  --font-heading: var(--font-neo-sans), var(--font-sans);
}

/* An app that serves internal and external themes. */
[data-theme-variant="external"] {
  --font-sans: var(--font-roboto), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}`;

const NESTED = `@layer base {
  [data-theme-variant] {
    font-family: var(--font-sans);
  }
}`;

export default function FontsPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="what-fuse-applies">What Fuse applies</h2>
      <p>
        Fuse sets body text in <code>--font-sans</code> and headings in <code>--font-heading</code>. It loads
        no font files and names no families. Both variables default to the system font stack, in the{" "}
        <code>theme</code> layer, so your own CSS sets them without <code>!important</code>.
      </p>
      <p>
        Internal apps use Inter and external apps use Roboto. Fjordkraft headings use Neo Sans, a licensed
        font that your app loads from its own files. Fuse parts set the weights 400, 500, 600 and 700.
      </p>

      <h2 id="next-js">Next.js</h2>
      <p>
        <code>next/font</code> gives each family a generated name, so read it through its{" "}
        <code>variable</code>. Use <code>next/font/local</code> for a licensed face, or for any face you want
        the build to read from disk instead of downloading.
      </p>
      <pre>
        <code>{NEXT_FONTS}</code>
      </pre>
      <pre>
        <code>{NEXT_LAYOUT}</code>
      </pre>
      <pre>
        <code>{NEXT_CSS}</code>
      </pre>

      <h2 id="fontsource">Any bundler</h2>
      <p>
        <code>@fontsource</code> packages declare the faces under their real names. Import one stylesheet per
        weight:
      </p>
      <pre>
        <code>{FONTSOURCE}</code>
      </pre>
      <pre>
        <code>{FONTSOURCE_CSS}</code>
      </pre>

      <h2 id="font-face">Plain CSS</h2>
      <pre>
        <code>{FONT_FACE}</code>
      </pre>

      <h2 id="per-brand">Per brand</h2>
      <p>
        Set the variables on the theme attributes. Set <code>--font-heading</code> wherever you set{" "}
        <code>--font-sans</code>, since the default <code>var(--font-sans)</code> resolves on the root.
      </p>
      <pre>
        <code>{PER_BRAND}</code>
      </pre>

      <h2 id="nested-themes">Nested themes</h2>
      <p>
        A <code>font-family</code> on <code>&lt;body&gt;</code> computes once there. If a page nests a{" "}
        <code>ThemeScope</code> of another variant, set the font on each scope:
      </p>
      <pre>
        <code>{NESTED}</code>
      </pre>
      <p>
        If the page&apos;s own chrome keeps one font while its scopes switch, add <code>:not(:root)</code> to
        the variant and scope rules.
      </p>

      <h2 id="brand-sites">Fonts on the brand sites</h2>
      <p>These are the fonts the brand sites drew on 2026-11-03, for reference. Fuse names none of them.</p>
      <DocsTable.Wrap>
        <DocsTable.Root>
          <thead>
            <tr>
              <DocsTable.HeaderCell scope="col">Brand</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Site</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Body</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Headings</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Licence</DocsTable.HeaderCell>
            </tr>
          </thead>
          <tbody>
            <tr>
              <DocsTable.BodyCell>Fjordkraft</DocsTable.BodyCell>
              <DocsTable.BodyCell>fjordkraft.no</DocsTable.BodyCell>
              <DocsTable.BodyCell>Roboto Flex</DocsTable.BodyCell>
              <DocsTable.BodyCell>Neo Sans Std</DocsTable.BodyCell>
              <DocsTable.BodyCell>Neo Sans is commercial (Monotype). Roboto Flex is OFL.</DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>TrøndelagKraft</DocsTable.BodyCell>
              <DocsTable.BodyCell>trondelagkraft.no/strom/</DocsTable.BodyCell>
              <DocsTable.BodyCell>Museo Sans (body text, h4, h6, inputs)</DocsTable.BodyCell>
              <DocsTable.BodyCell>Mohr (h1 to h3, forms)</DocsTable.BodyCell>
              <DocsTable.BodyCell>
                Both commercial: Museo Sans by exljbris, Mohr by Latinotype. Served from
                styleguide.fjordkraft.no.
              </DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>Gudbrandsdal Energi</DocsTable.BodyCell>
              <DocsTable.BodyCell>ge.no</DocsTable.BodyCell>
              <DocsTable.BodyCell>Hanken Grotesk</DocsTable.BodyCell>
              <DocsTable.BodyCell>Hanken Grotesk</DocsTable.BodyCell>
              <DocsTable.BodyCell>
                OFL, served by Next.js <code>next/font</code> with an Arial size-adjusted fallback.
              </DocsTable.BodyCell>
            </tr>
          </tbody>
        </DocsTable.Root>
      </DocsTable.Wrap>
    </DocsPage>
  );
}
