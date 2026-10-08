import type { ReactElement } from "react";

import Link from "next/link";

import { BundleSizes } from "../../../../components/bundle-sizes";
import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { DocsTable } from "../../../../components/docs-table";
import { TokenSwatchList } from "../../../../components/token-swatch-list";
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
        Control sizing lives in <code>--control-*</code> tokens and surface padding in{" "}
        <code>--surface-pad-*</code> tokens. Both have two settings, <code>dense</code> and{" "}
        <code>comfortable</code>, resolved once on the document root. Density is not a theme axis: the theme
        cascade decides colour, the root decides sizing, and no scope nests a second density. Both values are
        stamped explicitly, including <code>dense</code>.
      </p>
      <p>
        Button pads its labels with its own <code>--control-px-button-*</code> family. Dense matches the other
        controls, and comfortable widens it to 16px at <code>sm</code> and 32px at <code>default</code> and{" "}
        <code>lg</code>, so text fields, Select and Toggle keep their narrower inset. The edge beside a
        leading or trailing icon has its own <code>--control-px-button-icon-*</code> family, 12px at{" "}
        <code>sm</code> and 24px at <code>default</code> and <code>lg</code> when comfortable, so the icon
        does not sit tight against one end. An input group&apos;s addon buttons keep their own padding.
      </p>
      <p>
        Controls set their type from <code>--control-text</code> and <code>--control-leading</code>, 14/20px
        dense and 18/24px comfortable. The selection rows behind <code>CheckboxItem</code> and{" "}
        <code>RadioItem</code> have their own pair, <code>--control-text-row</code> and{" "}
        <code>--control-leading-row</code>: 14/20px dense and 16/24px comfortable, so a row&apos;s title and
        description stay a step below the field and button text around them.
      </p>

      <h3 id="surface-tiers">Surface tiers</h3>
      <p>
        Every shell pads with one of three surface tiers, picked by what it holds, so spacing stays coherent
        from a row out to the page. A shell subtracts the same tier from the corner it hands its inner parts,
        so padding and inner corner cannot drift apart. Outer corners do not change with density.
      </p>
      <DocsTable.Wrap>
        <DocsTable.Root>
          <thead>
            <tr>
              <DocsTable.HeaderCell scope="col">Tier</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Shells</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col" numeric>
                Dense
              </DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col" numeric>
                Comfortable
              </DocsTable.HeaderCell>
            </tr>
          </thead>
          <tbody>
            <tr>
              <DocsTable.BodyCell>
                <code>--surface-pad-sm</code>
              </DocsTable.BodyCell>
              <DocsTable.BodyCell>
                Shells of control-sized rows: DropdownMenu, Select, Combobox, NavigationMenu content, the
                floating Sidebar, Frame, Calendar and date-picker presets
              </DocsTable.BodyCell>
              <DocsTable.BodyCell numeric>4px</DocsTable.BodyCell>
              <DocsTable.BodyCell numeric>4px</DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>
                <code>--surface-pad-md</code>
              </DocsTable.BodyCell>
              <DocsTable.BodyCell>
                Compact content: Popover, Toast, Accordion items, the Field label card and Item&apos;s inline
                padding
              </DocsTable.BodyCell>
              <DocsTable.BodyCell numeric>12px</DocsTable.BodyCell>
              <DocsTable.BodyCell numeric>16px</DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>
                <code>--surface-pad-lg</code>
              </DocsTable.BodyCell>
              <DocsTable.BodyCell>
                Content surfaces: Card sections and the gaps between them, Dialog, Frame panels and Empty
              </DocsTable.BodyCell>
              <DocsTable.BodyCell numeric>16px</DocsTable.BodyCell>
              <DocsTable.BodyCell numeric>24px</DocsTable.BodyCell>
            </tr>
          </tbody>
        </DocsTable.Root>
      </DocsTable.Wrap>
      <p>
        Empty doubles the large tier from the <code>md</code> breakpoint up, 32px dense and 48px comfortable.
        Rows inside a small-tier shell are controls: menu, Select, Combobox, NavigationMenu and default
        Sidebar rows take the <code>sm</code> control height and the <code>xs</code> control inset, 32px tall
        with 8px inline padding when dense and 36px with 12px when comfortable. Tooltip, Tabs and the compact
        Item sizes keep their fixed padding.
      </p>

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
