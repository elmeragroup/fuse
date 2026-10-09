import type { ReactElement } from "react";

import Link from "next/link";

import { BundleSizes } from "../../../../components/bundle-sizes";
import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { DocsTable } from "../../../../components/docs-table";
import { TokenSwatchList } from "../../../../components/token-swatch-list";
import { DENSITY_CATALOG } from "../../../../generated/density-catalog";
import { COLOR_TOKENS } from "../../../../generated/token-reference";

const HREF = "/handbook/tokens";

export const metadata = pageMetadata(HREF);

export default function TokensPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <p>
        A token is a CSS custom property with a semantic name. Components are written against tokens and never
        against literal colours, so the same component markup paints correctly under all twenty-four themes.
        The swatches below show live values for whichever theme the header picker is on.
      </p>
      <p>
        Most role tokens are colours. The rest hold a length, such as <code>--radius</code>, a font stack,
        such as <code>--font-heading</code>, or a font weight, <code>--selection-title-weight</code>, and the{" "}
        <Link href="/handbook/theming">theming page</Link> says what each variant sets them to.
      </p>

      <h2 id="colour-tokens">Colour tokens</h2>
      <p>
        This list is generated from the library&apos;s own <code>@theme</code> block — the map that decides
        which token a utility such as <code>bg-primary</code> actually reads — so it cannot fall out of step
        with the stylesheet.
      </p>
      {/* Swatches render inside a `ThemeScope` on the header picker's theme, so the list shows
          real values for whichever of the twenty-four themes is selected. */}
      <TokenSwatchList tokens={COLOR_TOKENS.map((name) => ({ name, isColor: true }))} />

      <h2 id="what-a-component-reads">What a component reads</h2>
      <p>
        Every component page ends with a <strong>Tokens consumed</strong> section listing the exact custom
        properties that component&apos;s recipe touches, collected statically at docs build from the recipe
        and its CSS. It is generated, never hand-maintained: if that extraction ever stops being reliable the
        section is dropped rather than typed out by hand.
      </p>

      <h2 id="density">Density</h2>
      <p>
        Density has two settings, <code>dense</code> and <code>comfortable</code>, resolved once on the
        document root. It is not a theme axis: the theme cascade decides colour, the root decides sizing, and
        no scope nests a second density. Both settings are stamped explicitly, including <code>dense</code>.
      </p>
      <p>
        Every part declares a density role, which names the metrics it reads. A <strong>control</strong> is an
        interactive single-line box, a <strong>row</strong> one line of a collection, a{" "}
        <strong>surface</strong> a shell that pads content or a stack that spaces groups, and a{" "}
        <strong>label</strong> the words that describe a control. A <strong>layout</strong> part is sized by
        its children and a <strong>fixed</strong> part is identical at both densities. A row keeps its text
        size, so it grows only in height and padding, and a gap between one part&apos;s own pieces stays
        fixed. The docs density coverage test checks every rendered part against its role.
      </p>
      <p>
        Button pads its labels with its own <code>--control-px-button-*</code> and{" "}
        <code>--control-px-button-icon-*</code> families, so text fields, Select and Toggle keep their
        narrower inset. A shell pads with one of three surface tiers, picked by what it holds, and subtracts
        the same tier from the corner it hands its inner parts, so padding and inner corner cannot drift
        apart. Outer corners do not change with density.
      </p>
      <h3 id="density-metrics">Metrics by role</h3>
      <DensityMetricsTable />
      <h3 id="density-parts">Parts by role</h3>
      <DensityPartsTable />

      <h2 id="bundle-sizes">Measured bundle sizes</h2>
      <p>
        Budgets are regression ratchets, not aspirations: every published entry has a CI-enforced ceiling, and
        ceilings only move down unless a reviewed change says why. The numbers below are the measurements the
        gate records, paired with the ceiling it enforces — both read from the library&apos;s budget module at
        docs build, so this table cannot quietly disagree with the gate. Breaching a ceiling fails the build
        and blocks the <Link href="/releases">release</Link>.
      </p>
      <BundleSizes />
    </DocsPage>
  );
}

/** Every density metric, grouped by the role that reads it, in px per density. */
function DensityMetricsTable(): ReactElement {
  return (
    <DocsTable.Wrap>
      <DocsTable.Root>
        <thead>
          <tr>
            <DocsTable.HeaderCell scope="col">Role</DocsTable.HeaderCell>
            <DocsTable.HeaderCell scope="col">Metric</DocsTable.HeaderCell>
            <DocsTable.HeaderCell scope="col" numeric>
              Dense
            </DocsTable.HeaderCell>
            <DocsTable.HeaderCell scope="col" numeric>
              Comfortable
            </DocsTable.HeaderCell>
          </tr>
        </thead>
        <tbody>
          {DENSITY_CATALOG.flatMap(({ role, metrics }) =>
            metrics.map((metric) => (
              <tr key={metric.name} data-density-metric={metric.name}>
                <DocsTable.BodyCell>{role}</DocsTable.BodyCell>
                <DocsTable.BodyCell>
                  <code>{`--${metric.name}`}</code>
                </DocsTable.BodyCell>
                <DocsTable.BodyCell numeric>{`${String(metric.dense)}px`}</DocsTable.BodyCell>
                <DocsTable.BodyCell numeric>{`${String(metric.comfortable)}px`}</DocsTable.BodyCell>
              </tr>
            ))
          )}
        </tbody>
      </DocsTable.Root>
    </DocsTable.Wrap>
  );
}

/** Every part's declared role, by `data-slot` or a `slot[data-x=y]` override. */
function DensityPartsTable(): ReactElement {
  return (
    <DocsTable.Wrap>
      <DocsTable.Root>
        <thead>
          <tr>
            <DocsTable.HeaderCell scope="col">Role</DocsTable.HeaderCell>
            <DocsTable.HeaderCell scope="col">Parts</DocsTable.HeaderCell>
          </tr>
        </thead>
        <tbody>
          {DENSITY_CATALOG.map(({ role, parts }) => (
            <tr key={role} data-density-role={role}>
              <DocsTable.BodyCell>{role}</DocsTable.BodyCell>
              <DocsTable.BodyCell>
                {parts.map((part, index) => (
                  <span key={part}>
                    {index === 0 ? null : ", "}
                    <code>{part}</code>
                  </span>
                ))}
              </DocsTable.BodyCell>
            </tr>
          ))}
        </tbody>
      </DocsTable.Root>
    </DocsTable.Wrap>
  );
}
