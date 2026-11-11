import type { ReactElement } from "react";

import { DocsPage, pageMetadata } from "../../../components/docs-page";
import { INSTALL_COMMAND } from "../../../lib/docs-model";

const HREF = "/quick-start";

export const metadata = pageMetadata(HREF);

const STYLES_TAILWIND = `/* app/globals.css — Tailwind v4.1 or newer */
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@import "@elmeragroup/fuse/themes.css";
@source "../node_modules/@elmeragroup/fuse";`;

const STYLES_STANDALONE = `// app/layout.tsx — apps without Tailwind, once at the document root
import "@elmeragroup/fuse/styles.css";
import "@elmeragroup/fuse/themes.css";`;

const TEMPORAL_POLYFILL = `// Once per runtime, before any Temporal date code runs: the server entry, and the client
// entry (instrumentation-client.ts in Next.js).
import "@elmeragroup/fuse/temporal-polyfill";`;

const TEMPORAL_CLIENT_VALUE = `// app/delivery/page.tsx, a server component: the date arrives as ISO text.
import { DeliveryDate } from "./delivery-date";

export default async function Page() {
  const order = await loadOrder();
  return <DeliveryDate iso={order.deliveryDate} />;
}

// app/delivery/delivery-date.tsx
"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DeliveryDate({ iso }: { readonly iso: string }) {
  return <DatePickerField label="Delivery date" defaultValue={Temporal.PlainDate.from(iso)} />;
}`;

const SCAFFOLD = `import { ColorSchemeScript, LocaleProvider, ThemeProvider } from "@elmeragroup/fuse/theme";
import { documentAttributes } from "@elmeragroup/fuse/theme";

const THEME = { identity: "branded", brand: "fkas", segment: "private" } as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb-NO"
      {...documentAttributes({ theme: THEME, density: "comfortable" })}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript storageKey="color-scheme" defaultColorScheme="system" enableSystem />
      </head>
      <body>
        <ThemeProvider theme={THEME} storageKey="color-scheme" injectColorSchemeScript={false}>
          <LocaleProvider locale="nb-NO">
            <a className="skip-link" href="#main">
              Hopp til innholdet
            </a>
            <header>{/* site header */}</header>
            <nav aria-label="Hovedmeny">{/* primary navigation */}</nav>
            <main id="main">{children}</main>
            <footer>{/* site footer */}</footer>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}`;

const USAGE = `import { Button } from "@elmeragroup/fuse/button";

export function SaveButton() {
  return <Button>Lagre</Button>;
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
        <code>{INSTALL_COMMAND}</code>
      </pre>
      <p>
        Tailwind v4 apps compile Fuse&apos;s classes with their own build: import{" "}
        <code>@elmeragroup/fuse/css</code> and <code>themes.css</code>, and point <code>@source</code> at the
        installed package root. Adjust the <code>@source</code> path only when the stylesheet is not one
        directory below the app root.
      </p>
      <p>
        Fuse gives every element, your own markup included, a base-layer default border colour, the{" "}
        <code>--border</code> role, and any border colour utility still wins. Native form widgets outside Fuse
        parts keep their own border colour and native look. Import Fuse after <code>tailwindcss</code>. A
        preflight-free build that imports Tailwind&apos;s sheets into layers declares{" "}
        <code>@layer theme, base, components, utilities;</code> before them.
      </p>
      <pre>
        <code>{STYLES_TAILWIND}</code>
      </pre>
      <p>
        Apps without Tailwind import the prebuilt standalone stylesheet and <code>themes.css</code>. It
        includes the library utilities without Tailwind&apos;s preflight, so keep your own reset. Fuse&apos;s
        own elements, the ones that carry a <code>data-slot</code>, still take preflight&apos;s element rules
        from the base layer, and every utility and your own unlayered reset win over them, except{" "}
        <code>hidden</code>, which preflight makes <code>display: none !important</code> so it beats a
        part&apos;s display class.
      </p>
      <pre>
        <code>{STYLES_STANDALONE}</code>
      </pre>

      <h2 id="temporal">Temporal for dates</h2>
      <p>
        Fuse&apos;s Temporal date code reads <code>Temporal</code> from <code>globalThis</code> when it runs,
        and not every engine Fuse supports ships it yet. Fuse never installs it for you: import{" "}
        <code>@elmeragroup/fuse/temporal-polyfill</code> once in each runtime that renders. In a Next.js App
        Router app that is the root layout for the server, and <code>instrumentation-client.ts</code> for the
        browser, which runs before any of the app&apos;s client modules (see{" "}
        <a href="/handbook/temporal-migration#install-temporal">Install Temporal</a>). The root{" "}
        <code>@elmeragroup/fuse</code> entry never imports it.
      </p>
      <pre>
        <code>{TEMPORAL_POLYFILL}</code>
      </pre>
      <p>
        The entry installs <code>temporal-polyfill</code> only where no <code>Temporal</code> exists, and
        leaves an engine&apos;s own one in place. Where it installs, it also replaces{" "}
        <code>Intl.DateTimeFormat</code> with the polyfill&apos;s, which formats Temporal values. It adds
        about 20 kB gzipped to the bundle that imports it. Without it, development builds warn once in every
        engine, and an engine without Temporal throws a <code>TypeError</code> that names the entry.
      </p>
      <p>
        Fuse&apos;s type declarations, the root entry&apos;s included, name the global <code>Temporal</code>{" "}
        types, which come from TypeScript&apos;s own lib rather than from the polyfill. Type-check with
        TypeScript 6.0 or later and a <code>lib</code> that includes <code>esnext</code> (or{" "}
        <code>esnext.temporal</code>). With an older compiler or lib, Fuse&apos;s declarations report{" "}
        <code>Cannot find namespace &apos;Temporal&apos;</code>, or, under <code>skipLibCheck</code>, the date
        props are typed <code>any</code>.
      </p>
      <p>
        The date components&apos; date props (<code>value</code>, <code>defaultValue</code>,{" "}
        <code>minValue</code>, <code>maxValue</code> and a range&apos;s <code>start</code> and{" "}
        <code>end</code>) take Temporal objects, never ISO text, so a value is built in a client component.
        React passes a Temporal object from a server component to a client one as its ISO text, which the
        components refuse with a <code>TypeError</code>. A server component that holds a date as text, from a
        database or a URL, passes that text to its own small client component, which builds the value:
      </p>
      <pre>
        <code>{TEMPORAL_CLIENT_VALUE}</code>
      </pre>
      <p>
        A server component can still render <code>DateField</code>, <code>DatePickerField</code> and{" "}
        <code>DateRangePickerField</code> without a date value. The kind of value a field emits follows its
        value or default value, and without either its <code>granularity</code> and <code>timeZone</code>, so{" "}
        <code>onChange</code> is typed without a type argument.
      </p>

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
          correct before any JavaScript runs. <code>documentAttributes</code> stamps both, and the density is
          always yours to name: <code>dense</code> or <code>comfortable</code>, whatever the identity.
        </li>
        <li>
          <strong>
            <code>ColorSchemeScript</code>
          </strong>{" "}
          in <code>&lt;head&gt;</code>, ahead of anything paintable, and leave the provider&apos;s{" "}
          <code>injectColorSchemeScript</code> at its default, <code>false</code>, so the bootstrap is emitted
          once.
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
