import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { PaletteInspector } from "../../../../components/palette-inspector/palette-inspector";

const HREF = "/handbook/palettes";

export const metadata = pageMetadata(HREF);

const palettesPage = tv({
  slots: {
    // The page is wide for the table; its prose keeps the docs' reading measure.
    measure: "max-w-[39rem]",
  },
});

const { measure } = palettesPage();

export default function PalettesPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <div className={measure()}>
        <p>
          The table lays out Fuse&apos;s color tokens like Figma&apos;s variables panel: collections on the
          left, tokens as rows and one column per brand. The switches above it set the variant, segment and
          color scheme for every column. A brand with one segment, such as Telinet, shows a hatched cell for
          the other.
        </p>
        <p>
          A pill marks a role that points at another token, such as <code>--dialog</code> at{" "}
          <code>popover</code>, or whose value equals a step of its brand&apos;s ramps, such as
          Fjordkraft&apos;s light <code>--background</code> at <code>shade-100</code>. Other cells show a
          swatch and the hex or OKLCH value. Hover or focus a cell to see both formats and to outline the
          cells of the same color in its column. Click a cell to copy its value.
        </p>
        <p>
          Tab enters the table as one stop. The arrow keys move between cells, Home and End go to the ends of
          a row, and Ctrl or Cmd with Home or End goes to the first or last cell.
        </p>
      </div>

      <PaletteInspector />

      <div className={measure()}>
        <h2 id="brand-ramps">Brand ramps</h2>
        <p>
          Every brand has two ramps of eleven steps, <code>--brand-neutral-50</code> to{" "}
          <code>--brand-neutral-950</code> and <code>--brand-shade-50</code> to <code>--brand-shade-950</code>
          . They are tokens like the roles, so <code>bg-brand-shade-500</code> and{" "}
          <code>text-brand-neutral-900</code> work. A ramp changes with the brand and segment, and stays the
          same across color schemes and variants. Fjordkraft company and Fjordkraft Företag use the Bedrift
          ramps.
        </p>
        <p>
          The ramps come from the <code>brand</code> collection in the Figma Core file. Elmera and Nordic
          Green Energy have no ramps there, so Fuse generates theirs, and the table marks them as generated.
          Each step takes the brand&apos;s hue and the median lightness of the five Figma ramps at that step.
          The shade ramp passes through the brand color, at shade 900 for Elmera and shade 800 for Nordic
          Green Energy. The repository is now the source for the ramps, and Figma follows it.
        </p>
        <p>
          Use a role where one exists, so the product follows the theme. When a product needs a tone no role
          has, as the Gudbrandsdal Energi sidebar did, use a ramp step instead of a literal color.
        </p>

        <h2 id="contrast">Contrast</h2>
        <p>
          A contrast cell shows the pair in its own colors, its WCAG 2.2 ratio truncated to two decimals and
          its level for normal text: AA from 4.5:1 and AAA from 7:1. The table composites a translucent
          foreground over its surface first, as the browser does. Cells below AA are tinted, and the footer
          counts them.
        </p>
        <p>
          The <strong>text-grade pairs</strong> are the pairs Fuse&apos;s contrast gate holds at 4.5:1 in
          every theme and scheme. A theme that fails one does not build. The <strong>other role pairs</strong>{" "}
          are each remaining role with its <code>-foreground</code> on top, plus the pairs the token contract
          names. They are outside the text-grade list. Fuse&apos;s contrast tests hold some of them to a floor
          of their own and leave the rest unchecked, so some fall below AA. <code>feature-foreground</code> is
          decorative, and the <Link href="/accessibility#accepted-deviations">accessibility page</Link> lists
          the other deviations Fuse accepts. To see a theme&apos;s pairs in context, open the{" "}
          <Link href="/handbook/theme-matrix">theme matrix</Link>.
        </p>
      </div>
    </DocsPage>
  );
}
