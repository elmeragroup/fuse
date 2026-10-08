import type { ReactElement } from "react";

import Link from "next/link";

import { DemoFrame } from "../../../../components/demo-frame";
import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { InnerCornerMenu } from "./demos/inner-corner-menu";

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

const SIDEBAR_BRAND_OVERRIDE = `/* After the Fuse stylesheet, on the element that carries the theme attributes. */
.app-shell[data-theme-brand="tkas"] {
  --sidebar-brand: oklch(0.45 0.08 191);
  --sidebar-brand-foreground: oklch(1 0 0);
}

/* No one tone reaches 4.5:1 on both sidebars, so dark takes its own pair.
   The first selector matches under a dark ancestor, the second an element
   that is dark itself, such as a themed <html>. */
[data-theme="dark"] .app-shell[data-theme-brand="tkas"],
.app-shell[data-theme="dark"][data-theme-brand="tkas"] {
  --sidebar-brand: oklch(0.75 0.08 191);
  --sidebar-brand-foreground: oklch(0.205 0 0);
}`;

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

const OWN_TOKENS = `/* app/globals.css */
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@source "../node_modules/@elmeragroup/fuse";

@theme {
  /* Your tokens. After fuse/css, so yours win where both define a theme variable. */
}

:root {
  /* The role tokens the components you use read: whole colours, not channel triplets. */
  --primary: var(--your-brand);
  --primary-foreground: #fff;
  --radius: 0.5rem;
  --radius-button: var(--radius);
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
          <strong>Brand</strong> — one of seven four-character codes. See{" "}
          <Link href="/handbook/brands-and-segments">Brands &amp; segments</Link>.
        </li>
        <li>
          <strong>Segment</strong> — <code>private</code> or <code>company</code>.
        </li>
      </ul>
      <p>
        Two of the seven brands are pinned to one segment, which is why there are twenty-four legal themes and
        not twenty-eight. The <code>ThemeInput</code> type is a discriminated union that makes the four
        illegal combinations unrepresentable in typed code — they are a compile error, not a runtime check.
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
        Corner rounding is part of the theme. An external theme rounds cards from the brand&apos;s{" "}
        <code>--radius</code> and spaces the <code>rounded-*</code> scale around it in 2px{" "}
        <code>--radius-step</code> increments. Every standalone button rounds with{" "}
        <code>--radius-button</code>, which is a pill for Fjordkraft, Fjordkraft Företag and Telinet. Field
        boxes, from Input and Select to InputGroup and the date fields, round with <code>--radius-field</code>
        , the design system&apos;s 4px for every brand, and the parts inside a field round inside its corner.
        A button inside a button group keeps a compact corner instead, and a button group rounds both its ends
        that way, even when a field sits at one end. The checkbox and the standalone calendar keep the
        reference&apos;s 4px corner. The internal variant rounds every outer element with the one{" "}
        <code>--radius</code>. Its step is <code>0px</code> and its <code>--radius-button</code> and{" "}
        <code>--radius-field</code> are <code>var(--radius)</code>, so a host rule that reads either gets the
        same corner. To change the radius, override <code>--radius</code> on the element that carries the
        theme attributes, which is <code>&lt;html&gt;</code> or a <code>ThemeScope</code>. The theme rules
        resolve <code>--radius-button</code> there, so buttons move with the cards and fields. On a plain
        wrapper the override reaches cards and internal fields, but buttons keep the button radius the theme
        element resolved. To change the external field corner, override <code>--radius-field</code>. Nested
        internal surfaces share the radius, and dialogs round like cards. Inner parts, such as menu rows, tabs
        and the buttons inside a field, are the exception: see <a href="#inner-corners">Inner corners</a>.
      </p>
      <p>
        The outline button&apos;s border is part of the theme too. It reads <code>--button-outline</code> at{" "}
        <code>--button-outline-width</code>. External themes draw a 2px ring in the text colour, so{" "}
        <code>--button-outline</code> is <code>var(--foreground)</code>, and the button casts no shadow. The
        internal variant keeps a 1px <code>var(--border)</code> hairline with a small shadow, which only a 1px
        border casts.
      </p>
      <p>
        A checked <code>RadioItem</code> or <code>CheckboxItem</code> row draws its border in{" "}
        <code>--selection-checked-border</code>. Internal themes mark the checked row with{" "}
        <code>var(--primary)</code>. External themes set it to <code>var(--border)</code>, so the row keeps
        its resting border and the control alone shows the selection, as the external radio card does.
      </p>
      <p>
        The sidebar&apos;s brand pair, <code>--sidebar-brand</code> and{" "}
        <code>--sidebar-brand-foreground</code>, reaches 4.5:1 in every theme and color scheme. Where the
        brand color falls short on the sidebar, the theme steps its lightness away from the sidebar&apos;s
        until it passes and keeps the hue, so the tone can differ between light and dark. <code>--brand</code>{" "}
        keeps the brand color everywhere else.
      </p>
      <p>
        The stylesheet build computes the stepped tones, so the stylesheet declares them as literal colors.
        Fjordkraft, Fjordkraft Företag and TrøndelagKraft have one in light themes, and Gudbrandsdal Energi,
        Telinet, Elmera and Nordic Green Energy have one in dark themes. In those themes a host override of{" "}
        <code>--brand</code> no longer moves <code>--sidebar-brand</code>. In every dark theme,{" "}
        <code>--sidebar-brand-foreground</code> is the sidebar color instead of{" "}
        <code>--brand-foreground</code>. To restyle the sidebar brand, override both sidebar tokens on the
        element that carries the theme attributes, in a rule after the Fuse stylesheet. The rule applies in
        both color schemes and both variants, so give the dark scheme its own pair in a second rule. That rule
        needs two selectors, one for a theme element under a dark ancestor and one for an element that is dark
        itself, such as a themed <code>&lt;html&gt;</code>.
      </p>
      <pre>
        <code>{SIDEBAR_BRAND_OVERRIDE}</code>
      </pre>

      <h2 id="inner-corners">Inner corners</h2>
      <p>
        A part laid against a padded surface&apos;s edge rounds concentrically with the surface: its corner is
        the surface&apos;s corner less the padding and border between them, and never below 0. The part that
        pads it publishes that corner as <code>--inner-corner</code>, and the inner part rounds with the{" "}
        <code>rounded-inner</code> utility. Free-standing controls in a surface&apos;s content, such as a
        dialog&apos;s buttons, keep their own corner. The publishing parts are:
      </p>
      <ul>
        <li>
          Menus: <code>DropdownMenu.Content</code> and <code>DropdownMenu.SubContent</code>;{" "}
          <code>Combobox.List</code>, not <code>Combobox.Content</code>; <code>Select.Group</code>, and{" "}
          <code>Select.Content</code> for rows outside a group; and <code>NavigationMenu.Content</code> in its
          popup.
        </li>
        <li>
          Fields: every field box, <code>InputGroup.Addon</code>, <code>Combobox.Chips</code> and the date
          fields&apos; segment row.
        </li>
        <li>
          Containers: <code>Tabs.List</code>, <code>Frame.Root</code> and <code>Frame.Panel</code>, the
          floating <code>Sidebar</code>&apos;s header, footer and groups, and the date pickers&apos; preset
          group.
        </li>
        <li>
          Surfaces: <code>Card</code> and its sections, <code>Dialog.Content</code>,{" "}
          <code>Popover.Content</code>, <code>Tooltip.Content</code>, toasts, <code>Item</code>,{" "}
          <code>SelectionItem</code>, <code>Empty</code>, the rounded <code>Accordion</code> items and the
          standalone <code>Calendar</code>.
        </li>
      </ul>
      <p>
        Put a custom row or block inside one of these parts and give it <code>rounded-inner</code>, and it
        rounds like the parts beside it. Anywhere else, such as directly in <code>Combobox.Content</code>,{" "}
        <code>rounded-inner</code> rounds with the theme&apos;s <code>--radius</code>. A{" "}
        <code>ThemeScope</code> resets it, so a part inside a nested scope rounds with that scope&apos;s
        radius.
      </p>
      <DemoFrame
        section="handbook"
        slug="theming"
        id="inner-corner-demo"
        title="A custom block in a menu"
        file="inner-corner-menu.tsx">
        <InnerCornerMenu />
      </DemoFrame>

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
        <Link href="/handbook/theme-matrix">Theme matrix</Link> demonstrates this twenty-four times over.
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

      <h2 id="own-tokens">Keeping your own tokens</h2>
      <p>
        A host that adopts one component at a time can keep its own design tokens and skip{" "}
        <code>themes.css</code>. Every component still needs <code>@elmeragroup/fuse/css</code> for its
        variants and control metrics. Import it before your own <code>@theme</code> block, so your values win
        where both define a theme variable, then map the role tokens the components you use read.
      </p>
      <pre>
        <code>{OWN_TOKENS}</code>
      </pre>
      <p>
        Each component page lists those tokens under &quot;Tokens consumed&quot;; map that list, and add the
        next component&apos;s when you adopt it. Role tokens are whole colours in any notation, never channel
        triplets. Three things in <code>fuse/css</code> reach your own utilities as well, and the package
        README lists them in full: the <code>neutral-*</code> palette is remapped onto{" "}
        <code>--neutral-*</code>, which only <code>themes.css</code> defines; the <code>rounded-*</code> rungs
        become <code>--radius-step</code> multiples from <code>--radius</code>, with a 0px step fallback so
        your one radius applies everywhere; and the <code>data-open</code>, <code>data-selected</code>,{" "}
        <code>data-disabled</code> and related state variants are redeclared at one-class specificity.
      </p>

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
        scopes only, so every demo can be viewed in all twenty-four permutations while the page keeps its
        Elmera identity. Appearance changes the whole document through the library's colour-scheme API, offers
        light, dark and system, and remembers your choice; the matrix mirrors the same three-way control.
      </p>
    </DocsPage>
  );
}
