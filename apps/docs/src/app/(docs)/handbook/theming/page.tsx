import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";

const HREF = "/handbook/theming";

export const metadata = pageMetadata(HREF);

const DOCUMENT_THEME = `import { ThemeProvider, themeAttributes } from "@elmeragroup/ui/theme";
import { defaultDensityForVariant, densityAttributes } from "@elmeragroup/ui/theme";

const THEME = { variant: "external", brand: "fkas", segment: "private" } as const;

<html {...themeAttributes(THEME)} {...densityAttributes(defaultDensityForVariant(THEME.variant))}>
  <body>
    <ThemeProvider theme={THEME}>{children}</ThemeProvider>
  </body>
</html>;`;

const SCOPE = `import { ThemeScope } from "@elmeragroup/ui/theme";

// Re-themes this subtree only. Overlays opened inside it portal into it.
<ThemeScope theme={{ variant: "external", brand: "tkas", segment: "company" }}>
  <TrackSummary />
</ThemeScope>;`;

export default function ThemingPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="three-axes">Three axes</h2>
      <p>A theme is exactly three coordinates, and nothing else:</p>
      <ul>
        <li>
          <strong>Variant</strong> — <code>internal</code> or <code>external</code>. Internal is the
          grayscale, information-dense look for staff tooling; external is the brand-coloured, customer-facing
          look.
        </li>
        <li>
          <strong>Brand</strong> — one of six four-character codes. See{" "}
          <Link href="/handbook/brands-and-segments">Brands &amp; segments</Link>.
        </li>
        <li>
          <strong>Segment</strong> — <code>private</code> or <code>company</code>.
        </li>
      </ul>
      <p>
        Two of the six brands are pinned to one segment, which is why there are twenty legal themes and not
        twenty-four. The <code>ThemeInput</code> type is a discriminated union that makes the four illegal
        combinations unrepresentable in typed code — they are a compile error, not a runtime check.
      </p>

      <h2 id="how-it-resolves">How it resolves</h2>
      <p>
        Themes are pure CSS. Three data attributes on one element — <code>data-theme-variant</code>,{" "}
        <code>data-theme-brand</code>, <code>data-theme-segment</code> — and the stylesheet&apos;s layers
        resolve the token values beneath them: shared defaults, then brand pointers, then the internal reset
        or the external brand palette, then the one segment delta that genuinely differs.
      </p>
      <p>
        Because it is attributes plus cascade, brand is correct at first paint with JavaScript disabled, and
        re-theming a subtree costs one wrapper element rather than a second stylesheet.
      </p>

      <h2 id="document-theme">The document theme</h2>
      <p>
        A page sets its brand once, on <code>&lt;html&gt;</code>, and mounts one <code>ThemeProvider</code>{" "}
        with the same theme. The provider is fully controlled: there is no <code>setTheme</code> for variant,
        brand or segment. A host changes brand by passing a new <code>theme</code> prop.
      </p>
      <pre>
        <code>{DOCUMENT_THEME}</code>
      </pre>
      <p>
        Density is composed here too, and is not a theme axis — the root resolves one density for the whole
        document, and both values are stamped explicitly.
      </p>

      <h2 id="theme-scope">Scoped re-theming</h2>
      <p>
        <code>ThemeScope</code> re-themes a subtree. It is never a document writer: it does not stamp{" "}
        <code>&lt;html&gt;</code>, does not fork colour-scheme state, and has no density prop.
      </p>
      <pre>
        <code>{SCOPE}</code>
      </pre>
      <p>
        The containment problem a scope creates is solved at the component layer. <code>ThemeScope</code>{" "}
        publishes its rendered element through context, and every overlay resolves its portal target as:
        explicit <code>container</code> → nearest scope element → the primitive default. A popup opened inside
        a scope therefore lands inside it and inherits its theme, instead of escaping to{" "}
        <code>document.body</code> and silently taking the page theme. The{" "}
        <Link href="/handbook/theme-matrix">Theme matrix</Link> demonstrates this twenty times over.
      </p>
      <p>
        <code>useTheme()</code> returns the nearest theme plus its slug, and throws outside a provider or
        scope.
      </p>

      <h2 id="colour-scheme">Colour scheme</h2>
      <p>
        Light and dark are separate from the three theme axes. Colour-scheme state lives on the document
        writer; scopes do not fork it. Emit <code>ColorSchemeScript</code> in <code>&lt;head&gt;</code> ahead
        of anything paintable so the stored preference applies before first paint, and pass{" "}
        <code>injectColorSchemeScript={"{false}"}</code> to the provider so the bootstrap is emitted exactly
        once.
      </p>

      <h2 id="in-these-docs">In these docs</h2>
      <p>
        This site is a worked example of the split. Its own document theme is fixed at{" "}
        <code>internal-elma-private</code> and the chrome you are reading is light-only and unbranded. The
        picker in the header does <strong>not</strong> re-render the document provider or touch{" "}
        <code>&lt;html&gt;</code>; it writes docs-local preview state that only demo stages and theme scopes
        consume. That is why every demo can be viewed in all twenty permutations without the page around it
        changing colour.
      </p>
    </DocsPage>
  );
}
