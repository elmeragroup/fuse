import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { DocsTable } from "../../../../components/docs-table";

const HREF = "/handbook/localization";

export const metadata = pageMetadata(HREF);

const PROVIDER = `import { ElmeraGroupUiProvider } from "@elmeragroup/ui/theme";

<ElmeraGroupUiProvider locale="nb-NO">{children}</ElmeraGroupUiProvider>;`;

const OVERRIDE = `// The dictionary already returns "Ingen resultater." under nb-NO.
// The prop exists for copy control, not for translation.
<Combobox.Empty>Fant ingen avtaler.</Combobox.Empty>;`;

const SWITCHER = `"use client";

import { useState } from "react";
import { ElmeraGroupUiProvider } from "@elmeragroup/ui/theme";
import type { SupportedLocale } from "@elmeragroup/ui/theme";

const LOCALES = [
  { code: "nb-NO", label: "Norsk" },
  { code: "sv-SE", label: "Svenska" },
  { code: "fi-FI", label: "Suomi" },
  { code: "en-US", label: "English" },
] as const satisfies readonly { code: SupportedLocale; label: string }[];

export function LocalizedApp({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<SupportedLocale>("nb-NO");

  return (
    <ElmeraGroupUiProvider locale={locale}>
      <label>
        <span>Language</span>
        <select
          value={locale}
          onChange={(event) => {
            setLocale(event.target.value as SupportedLocale);
          }}>
          {LOCALES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {children}
    </ElmeraGroupUiProvider>
  );
}`;

export default function LocalizationPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="mechanism">The mechanism</h2>
      <p>
        Components that render user-visible or assistive-technology-only strings — a dialog&apos;s close
        label, a combobox&apos;s empty state, pagination&apos;s landmark name — own a co-located dictionary of
        plain TypeScript modules, one per locale. At render time a component reads the app&apos;s locale from
        context and formats its keys through a tiny, dependency-free string runtime.
      </p>
      <p>
        There is no glob import, no JSON, no string-compiler build step, no locale-subsetting plugin and no
        ICU parser. Below roughly ten locales none of that pays for itself, and at four the whole eager
        payload is a few hundred bytes per string-bearing component. Plural, number and select cases are
        hand-written message functions.
      </p>

      <h2 id="supported-locales">Supported locales</h2>
      <p>
        The <code>SupportedLocale</code> union is exactly four members, and all four ship eagerly:
      </p>
      <DocsTable.Wrap>
        <DocsTable.Root>
          <thead>
            <tr>
              <DocsTable.HeaderCell scope="col">Locale</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Language</DocsTable.HeaderCell>
            </tr>
          </thead>
          <tbody>
            <tr>
              <DocsTable.BodyCell>
                <code>nb-NO</code>
              </DocsTable.BodyCell>
              <DocsTable.BodyCell>Norwegian Bokmål</DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>
                <code>sv-SE</code>
              </DocsTable.BodyCell>
              <DocsTable.BodyCell>Swedish</DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>
                <code>en-US</code>
              </DocsTable.BodyCell>
              <DocsTable.BodyCell>English</DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>
                <code>fi-FI</code>
              </DocsTable.BodyCell>
              <DocsTable.BodyCell>Finnish</DocsTable.BodyCell>
            </tr>
          </tbody>
        </DocsTable.Root>
      </DocsTable.Wrap>
      <p>
        The runtime&apos;s <code>en-US</code> fallback is defensive behaviour for invalid untyped JavaScript
        input — not a fifth public locale, and not a promise about regional variants. If the set ever
        approaches ten locales, per-locale module splitting becomes worth revisiting; at four it is not.
      </p>

      <h2 id="locale-source">Where locale comes from</h2>
      <p>
        One place: <code>ElmeraGroupUiProvider</code>, whose <code>locale</code> prop is{" "}
        <strong>required</strong>. Apps never pass a locale to an individual component.
      </p>
      <pre>
        <code>{PROVIDER}</code>
      </pre>
      <p>
        A single-country app sets it once. A multilingual whitelabel app re-renders the provider with the
        user&apos;s selection. The provider is plain data — no <code>navigator</code> sniffing, no hydration
        correction — so server and client render identically and no inline script is needed.
      </p>
      <p>
        Keep this in step with the <code>lang</code> attribute on <code>&lt;html&gt;</code>, which is your
        app&apos;s responsibility. See <Link href="/quick-start">Quick start</Link>.
      </p>

      <h2 id="override-precedence">Override precedence</h2>
      <p>
        <strong>An explicit string prop always wins over the dictionary.</strong> Those props are optional:
        the dictionary guarantees a correct-language default, and the prop exists so you can control the copy
        — not so you have to supply translations.
      </p>
      <pre>
        <code>{OVERRIDE}</code>
      </pre>
      <p>
        Note what stays yours. The library does not translate visible consumer content: preset item labels
        come from the visible children you wrote, loader labels stay consumer-supplied because the surrounding
        pending action provides the wording, and confirmation copy is consumer-owned.
      </p>

      <h2 id="language-switcher">A language switcher</h2>
      <p>
        Because locale is a provider prop and nothing more, a switcher is just state above the provider. No
        library API is involved beyond re-rendering it.
      </p>
      <pre>
        <code>{SWITCHER}</code>
      </pre>
      <p>
        Update the document&apos;s <code>lang</code> alongside this, and persist the choice wherever you keep
        the rest of your user preferences.
      </p>

      <h2 id="testing">Testing</h2>
      <p>
        Every string-bearing component carries one test per shipped locale asserting the dictionary default
        renders, plus one test that a prop override wins.
      </p>
    </DocsPage>
  );
}
