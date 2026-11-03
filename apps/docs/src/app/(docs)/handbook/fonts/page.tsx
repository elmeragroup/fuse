import type { ReactElement } from "react";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { DocsTable } from "../../../../components/docs-table";

const HREF = "/handbook/fonts";

export const metadata = pageMetadata(HREF);

/**
 * The app CSS each recipe ends with. The internal fonts go on the root and on every internal scope,
 * so an internal scope inside an external one resets them. The Fjordkraft heading rule names the
 * external variant, so it outweighs the variant rule.
 */
function appFontCss(inter: string, roboto: string, neoSans: string): string {
  return `:root,
[data-theme-variant="internal"] {
  --font-sans: ${inter}, ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}

[data-theme-variant="external"] {
  --font-sans: ${roboto}, ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}

[data-theme-variant="external"]:is([data-theme-brand="fkas"], [data-theme-brand="fkab"]) {
  --font-heading: ${neoSans}, var(--font-sans);
}`;
}

const NEXT_FONTS = `// app/fonts.ts
import { Inter, Roboto } from "next/font/google";
import localFont from "next/font/local";

// next/font reads its options at build time, so each one is a literal.
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
export const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-roboto",
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
import { inter, neoSans, roboto } from "./fonts";

<html
  lang="nb"
  className={\`\${inter.variable} \${roboto.variable} \${neoSans.variable}\`}
  {...themeAttributes(theme)}>
  <body className="font-sans">{children}</body>
</html>;`;

const NEXT_CSS = appFontCss("var(--font-inter)", "var(--font-roboto)", "var(--font-neo-sans)");

const FONTSOURCE = `// The module that renders <html>.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/600.css";
import "@fontsource/roboto/700.css";`;

const FONTSOURCE_CSS = appFontCss("Inter", "Roboto", '"Neo Sans"');

const FONT_FACE = `@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-latin-400.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "Roboto";
  src: url("/fonts/roboto-latin-400.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "Neo Sans";
  src: url("/fonts/NeoSans-Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
}
/* One rule per family and weight: 400, 500, 600 and 700. */

${appFontCss('"Inter"', '"Roboto"', '"Neo Sans"')}`;

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
        weight, and declare Neo Sans with <code>@font-face</code>, as in the next recipe:
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
        Each recipe ends with the Fjordkraft heading rule. It names the external variant as well as the brand,
        so it outweighs the variant rule.
      </p>

      <h2 id="nested-themes">Nested themes</h2>
      <p>
        The <code>font-family</code> on <code>&lt;body&gt;</code> resolves the variables once, at the body. If
        a page nests a <code>ThemeScope</code> of another variant, set the font on each scope:
      </p>
      <pre>
        <code>{NESTED}</code>
      </pre>
      <p>
        To keep the page chrome in one font while its scopes switch, add <code>:not(:root)</code> to the
        variant and scope rules.
      </p>

      <h2 id="brand-sites">Fonts on the brand sites</h2>
      <p>The brand sites drew these fonts on 2026-11-03. Fuse names none of them.</p>
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
                Commercial. Museo Sans is by exljbris and Mohr by Latinotype. styleguide.fjordkraft.no serves
                both.
              </DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>Gudbrandsdal Energi</DocsTable.BodyCell>
              <DocsTable.BodyCell>ge.no</DocsTable.BodyCell>
              <DocsTable.BodyCell>Hanken Grotesk</DocsTable.BodyCell>
              <DocsTable.BodyCell>Hanken Grotesk</DocsTable.BodyCell>
              <DocsTable.BodyCell>
                OFL. The site loads it with <code>next/font</code> and an Arial fallback sized to match.
              </DocsTable.BodyCell>
            </tr>
          </tbody>
        </DocsTable.Root>
      </DocsTable.Wrap>
    </DocsPage>
  );
}
