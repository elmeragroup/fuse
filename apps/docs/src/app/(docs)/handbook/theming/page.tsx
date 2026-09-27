import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";

const HREF = "/handbook/theming";

export const metadata = pageMetadata(HREF);

const DOCUMENT_THEME = `import { ThemeProvider, themeAttributes } from "@elmeragroup/fuse/theme";
import { defaultDensityForVariant, densityAttributes } from "@elmeragroup/fuse/theme";

const THEME = { variant: "external", brand: "fkas", segment: "private" } as const;

<html {...themeAttributes(THEME)} {...densityAttributes(defaultDensityForVariant(THEME.variant))}>
  <body>
    <ThemeProvider theme={THEME}>{children}</ThemeProvider>
  </body>
</html>;`;

const SCOPE = `import { ThemeScope } from "@elmeragroup/fuse/theme";

// Re-themes this subtree only. Overlays opened inside it portal into it.
<ThemeScope theme={{ variant: "external", brand: "tkas", segment: "company" }}>
  <TrackSummary />
</ThemeScope>;`;

const NEXT_PAGES = `// pages/_document.tsx
import { Head, Html, Main, NextScript } from "next/document";
import {
  ColorSchemeScript,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/fuse/theme";
import { colorScheme, theme } from "../lib/theme";

export default function Document() {
  return (
    <Html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <Head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// pages/_app.tsx
import type { AppProps } from "next/app";
import { ThemeProvider } from "@elmeragroup/fuse/theme";
import { colorScheme, theme } from "../lib/theme";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      theme={theme}
      storageKey={colorScheme.storageKey}
      defaultColorScheme={colorScheme.defaultColorScheme}
      enableSystem={colorScheme.enableSystem}
      injectColorSchemeScript={false}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}`;

const TANSTACK_START = `import { ScriptOnce } from "@tanstack/react-router";
import {
  colorSchemeScriptSource,
  defaultDensityForVariant,
  densityAttributes,
  ThemeProvider,
  themeAttributes,
} from "@elmeragroup/fuse/theme";
import { colorScheme, theme } from "./theme";

export function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ScriptOnce>{colorSchemeScriptSource(colorScheme)}</ScriptOnce>
      </head>
      <body>
        <ThemeProvider theme={theme} {...colorScheme} injectColorSchemeScript={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}`;

const REACT_ROUTER = `import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import {
  ColorSchemeScript,
  defaultDensityForVariant,
  densityAttributes,
  ThemeProvider,
  themeAttributes,
} from "@elmeragroup/fuse/theme";
import { colorScheme, theme } from "./theme";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider
          theme={theme}
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
          injectColorSchemeScript={false}>
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}`;

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
      <p>
        Corner rounding is part of the theme. An external theme rounds cards and fields from the brand&apos;s{" "}
        <code>--radius</code> and spaces the <code>rounded-*</code> scale around it in 2px{" "}
        <code>--radius-step</code> increments. Every standalone button rounds with{" "}
        <code>--radius-button</code>, which is a pill for Fjordkraft, Fjordkraft Företag and Telinet. A button
        inside a button group, a field or a preset list keeps a field-sized corner instead, and the checkbox,
        the phone country trigger and the standalone calendar keep the reference&apos;s 4px corner. The
        internal variant rounds every element with the one <code>--radius</code>. Its step is <code>0px</code>{" "}
        and its <code>--radius-button</code> is <code>var(--radius)</code>, so a host rule that reads{" "}
        <code>var(--radius-button)</code> gets the same corner. To change the radius, override{" "}
        <code>--radius</code> on the element that carries the theme attributes, which is{" "}
        <code>&lt;html&gt;</code> or a <code>ThemeScope</code>. The theme rules resolve{" "}
        <code>--radius-button</code> there, so buttons move with the cards and fields. On a plain wrapper the
        override reaches cards and fields, but buttons keep the button radius the theme element resolved.
        Nested internal surfaces share the radius instead of stepping inward, and dialogs round like cards.
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
        of anything paintable so the stored preference applies before first paint, and leave the
        provider&apos;s <code>injectColorSchemeScript</code> at its default, <code>false</code>, so the
        bootstrap is emitted exactly once.
      </p>

      <h2 id="first-paint">First paint in your framework</h2>
      <p>
        Use the <Link href="/quick-start#page-scaffold">Quick start scaffold</Link> for the shared setup. Pass
        the same resolved theme to the document attributes and provider, and stamp density on the document
        root. Keep <code>storageKey</code>, <code>defaultColorScheme</code>, <code>enableSystem</code> and any{" "}
        <code>forcedColorScheme</code> identical on the bootstrap and provider. ThemeProvider supplies context
        and runtime updates; the host places the classic bootstrap before paintable content.
      </p>
      <pre>
        <code>{`html, body {
  background: var(--background);
  color: var(--foreground);
}`}</code>
      </pre>
      <p>
        Import <code>themes.css</code> alongside your chosen CSS mode. The token-backed canvas prevents a
        default browser background flash. Put <code>suppressHydrationWarning</code> on the React-owned html
        element when the bootstrap changes data-theme before hydration. If you omit colour-scheme support,
        omit the script, warning and provider colour-scheme options together.
      </p>
      <p>
        Pass a nonce to the bootstrap for nonce-based CSP. Keep the generated bootstrap in a server or
        build-time module rather than copying its IIFE into application source. The library uses local
        storage, not cookies, and CSS owns native colour-scheme. Hash-based CSP is unsupported. React-created
        script nodes do not provide first paint.
      </p>
      <p>
        A route that must first-paint in a forced scheme needs a document adapter that knows the force while
        generating HTML and passes forcedColorScheme to both bootstrap and provider. A descendant
        ForceColorScheme changes the document only at runtime.
      </p>
      <p>
        Next App Router and Vite have production first-paint fixtures in apps/docs and apps/static-theme,
        including delayed or blocked React execution. Next Pages, TanStack Start and React Router below are
        written recipes without fixture verification. These first-paint proofs are separate from
        packed-package release fixtures.
      </p>

      <h2 id="next-app-router">Next App Router</h2>
      <p>
        The Quick start layout puts ColorSchemeScript in head. This also avoids the hidden streaming preamble
        Next can insert at the start of body. Leave the provider&apos;s <code>injectColorSchemeScript</code>{" "}
        at its default, false. A forced route needs a route-group layout or other document that supplies the
        same force to both. React Aria consumers use UiProviders instead of nesting it with LocaleProvider.
        Put its function-valued navigate prop in an app-owned client wrapper that calls useRouter and passes
        router.push.
      </p>

      <h2 id="next-pages">Next Pages</h2>
      <p>
        The document owns html attributes and the classic script; the app owns the provider. Share theme and
        colour-scheme options through an app-owned module. Put the script in Head or before Main. A route
        force must be known to the document and the app provider.
      </p>
      <pre>
        <code>{NEXT_PAGES}</code>
      </pre>

      <h2 id="tanstack-start">TanStack Start</h2>
      <p>
        The root document owns attributes. Call colorSchemeScriptSource at document-render time and place
        ScriptOnce before children and module scripts. A route-specific force goes into both that call and
        ThemeProvider.
      </p>
      <pre>
        <code>{TANSTACK_START}</code>
      </pre>

      <h2 id="react-router">React Router 7 framework mode</h2>
      <p>
        The root Layout owns attributes and emits ColorSchemeScript in head before Meta or Links content that
        depends on the marker. A route force must reach both the head script and provider while rendering the
        document.
      </p>
      <pre>
        <code>{REACT_ROUTER}</code>
      </pre>

      <h2 id="vite">Vite and client-rendered apps</h2>
      <p>
        Stamp brand and density into index.html at build time. Inject a raw classic script before the module
        entry through transformIndexHtml with order set to post. The apps/static-theme fixture demonstrates
        this adapter.
      </p>
      <ol>
        <li>
          Import themeAttributes, densityAttributes, defaultDensityForVariant and colorSchemeScriptSource in
          vite.config.ts. Use the same document options as the React provider. Keep these calls out of the
          client graph.
        </li>
        <li>
          Stamp the three brand attributes and data-density on html. Reject source HTML that already has them
          so configuration cannot silently overwrite another owner.
        </li>
        <li>
          Put the generated classic bootstrap before the first module script. Hoist the generated stylesheet
          links before it so background tokens exist before first paint. Keep the token-backed canvas rule in
          the global stylesheet.
        </li>
        <li>
          Mount ThemeProvider with matching options, leaving injectColorSchemeScript at its default, false. A
          bundling config loader can rewrite Function.prototype.toString and break the closed IIFE. The
          fixture uses the native config loader with the built theme module.
        </li>
        <li>
          For route-specific forced first paint, use a separate HTML entry or a transform that resolves the
          route and passes the same force to bootstrap and provider.
        </li>
      </ol>

      <h2 id="in-these-docs">In these docs</h2>
      <p>
        <code>data-theme="dark"</code> activates dark palettes on both the document and nested theme scopes.
        Internal themes use neutral colors; external themes use their brand palettes. The{" "}
        <Link href="/handbook/theme-matrix">theme matrix</Link> has light, dark, and system controls for
        comparing them. Colour scheme does not change theme slugs, density, fonts, or brand primitives.
      </p>
      <p>
        This site is a worked example of the split. Its own document theme is fixed at{" "}
        <code>internal-elma-private</code> and the chrome you are reading consumes that theme's light and dark
        tokens. The header's theme settings menu writes docs-local preview state from its labelled radio
        groups (Appearance, Variant, Brand, Segment). Variant, Brand and Segment feed demo stages and theme
        scopes only, so every demo can be viewed in all twenty permutations while the page keeps its Elmera
        identity. Appearance changes the whole document through the library's colour-scheme API, offers light,
        dark and system, and remembers your choice; the matrix mirrors the same three-way control.
      </p>
    </DocsPage>
  );
}
