import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { BRANDS, themeSlug } from "@elmeragroup/fuse/theme";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { DocsTable } from "../../../../components/docs-table";
import { LEGAL_THEMES, THEME_BRANDS } from "../../../../lib/theme";

const HREF = "/handbook/brands-and-segments";

const brandsAndSegments = tv({
  slots: {
    mono: "text-xs font-mono",
  },
});

const { mono } = brandsAndSegments();

export const metadata = pageMetadata(HREF);

/** The permutations the pin table forbids — listed as absent, never rendered as cells. */
const ILLEGAL_SLUGS = [
  "internal-fkab-private",
  "external-fkab-private",
  "internal-fkse-company",
  "external-fkse-company",
] as const;

export default function BrandsAndSegmentsPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="brands">Brands</h2>
      <p>
        Six brand codes, each four characters, fixed. The code is what appears in types, attributes, slugs and
        every line of code; the display name is what a customer sees. The two differ deliberately for{" "}
        <code>fkse</code>, which renders under the trade name Telinet while keeping its code everywhere.
      </p>
      <DocsTable.Wrap>
        <DocsTable.Root>
          <thead>
            <tr>
              <DocsTable.HeaderCell scope="col">Code</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Display name</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Segments</DocsTable.HeaderCell>
            </tr>
          </thead>
          <tbody>
            {THEME_BRANDS.map((code) => (
              <tr key={code}>
                <DocsTable.BodyCell>
                  <code>{code}</code>
                </DocsTable.BodyCell>
                <DocsTable.BodyCell>{BRANDS[code].displayName}</DocsTable.BodyCell>
                <DocsTable.BodyCell className={mono()}>{BRANDS[code].segments.join(", ")}</DocsTable.BodyCell>
              </tr>
            ))}
          </tbody>
        </DocsTable.Root>
      </DocsTable.Wrap>
      <p>
        Steddi, NGE and Trumf are outside this theme set. <code>elma</code> is corporate Elmera and is not
        pinned.
      </p>

      <h2 id="segments">Segments</h2>
      <p>
        <code>private</code> is the consumer-facing segment and <code>company</code> the business-facing one.
        At v1 the two segments differ in exactly one place in the stylesheet — a single delta rule for
        external <code>fkas</code> — so a segment is a small, honest override rather than a second palette.
      </p>

      <h2 id="pinned-brands">Pinned brands</h2>
      <p>
        Two brands exist for one segment only: <code>fkab</code> is pinned to <code>company</code> and{" "}
        <code>fkse</code> is pinned to <code>private</code>. Four of the other brands span both. Two variants
        × that pin table gives <strong>{String(LEGAL_THEMES.length)} legal themes</strong> — ten internal and
        ten external.
      </p>

      <h2 id="illegal-permutations">The four illegal permutations</h2>
      <p>These do not exist, and three independent tiers keep it that way:</p>
      <ul>
        {ILLEGAL_SLUGS.map((slug) => (
          <li key={slug}>
            <code>{slug}</code>
          </li>
        ))}
      </ul>
      <ol>
        <li>
          <strong>Compile time</strong> — the <code>ThemeInput</code> union makes them unrepresentable in
          typed code.
        </li>
        <li>
          <strong>Runtime</strong> — the provider validates and refuses to write an illegal combination, and{" "}
          <code>parseThemeSlug</code> returns <code>null</code> for one rather than coercing it.
        </li>
        <li>
          <strong>UI</strong> — a picker disables the illegal segment option for a pinned brand, so it can
          never be expressed. The picker in this site&apos;s header does exactly that; select{" "}
          <code>fkab</code> and watch <code>private</code> go away.
        </li>
      </ol>
      <p>
        CSS stays best-effort by design: the stylesheet neither forbids nor special-cases an illegal attribute
        combination. Enforcement is the provider&apos;s job, not the cascade&apos;s.
      </p>

      <h2 id="the-twenty">The twenty slugs</h2>
      <p>
        Each theme has a canonical slug, <code>variant-brand-segment</code>. The{" "}
        <Link href="/handbook/theme-matrix">Theme matrix</Link> renders all of them side by side.
      </p>
      <ul className={mono()}>
        {LEGAL_THEMES.map((theme) => (
          <li key={themeSlug(theme)}>{themeSlug(theme)}</li>
        ))}
      </ul>
    </DocsPage>
  );
}
