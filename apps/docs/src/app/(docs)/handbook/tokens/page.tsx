import type { ReactElement } from "react";

import Link from "next/link";

import { BundleSizes } from "../../../../components/bundle-sizes";
import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { TokenSwatchList } from "../../../../components/token-swatch-list";
import { COLOR_TOKENS } from "../../../../generated/token-reference";

const HREF = "/handbook/tokens";

export const metadata = pageMetadata(HREF);

export default function TokensPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <p>
        A token is a CSS custom property with a semantic name. Components are written against tokens and never
        against literal colours, so the same component markup paints correctly under all twenty themes. The
        swatches below show live values for whichever theme the header picker is on.
      </p>

      <h2 id="colour-tokens">Colour tokens</h2>
      <p>
        This list is generated from the library&apos;s own <code>@theme</code> block — the map that decides
        which token a utility such as <code>bg-primary</code> actually reads — so it cannot fall out of step
        with the stylesheet.
      </p>
      {/* Swatches render inside a `ThemeScope` on the header picker's theme, so the list shows
          real values for whichever of the twenty themes is selected. */}
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
        Control sizing lives in <code>--control-*</code> tokens and has two settings, <code>dense</code> and{" "}
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
