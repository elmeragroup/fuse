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
          The table lists Fuse&apos;s color tokens the way Figma&apos;s variables panel does: collections on
          the left, tokens as rows and the seven brands as columns. The switches above it pick the variant,
          segment and color scheme every column shows. A brand pinned to one segment, such as Telinet to
          private, shows a hatched cell under the other.
        </p>
        <p>
          A pill marks a role that names another token, such as <code>--dialog</code> naming{" "}
          <code>popover</code>, or whose value equals a step of its brand&apos;s ramps, such as
          Fjordkraft&apos;s light <code>--background</code> on <code>shade-100</code>. Any other value shows
          as a swatch and its hex or OKLCH. Hover or focus a cell for both formats, and press it to copy the
          value. While a cell is in focus, the cells of the same color in its column are outlined.
        </p>
        <p>
          Tab moves into the table as one stop. The arrow keys move between cells, Home and End along a row,
          and Ctrl with Home or End to the first and last cell.
        </p>
      </div>

      <PaletteInspector />

      <div className={measure()}>
        <h2 id="brand-ramps">Brand ramps</h2>
        <p>
          Every brand has two ramps of eleven steps, <code>--brand-neutral-50</code> to{" "}
          <code>--brand-neutral-950</code> and <code>--brand-shade-50</code> to <code>--brand-shade-950</code>
          , and they are tokens like any role, so <code>bg-brand-shade-500</code> and{" "}
          <code>text-brand-neutral-900</code> work. They hold one value per brand and segment in both color
          schemes and both variants. Fjordkraft company and Fjordkraft Företag take the Bedrift ramps.
        </p>
        <p>
          The ramps come from the <code>brand</code> collection in the Figma Core file. Elmera and Nordic
          Green Energy have no ramps there, so theirs are generated from the brand color and marked as
          generated: each step takes the median lightness of the five Figma ramps at that step and the
          brand&apos;s hue, and the shade ramp passes through the brand color itself, at shade 900 for Elmera
          and shade 800 for Nordic Green Energy. The repository is the source from here on, and Figma follows
          it.
        </p>
        <p>
          Reach for a role first, so the product follows the theme. When a product needs a tone no role holds,
          as the Gudbrandsdal Energi sidebar did, pick a ramp step rather than a literal color.
        </p>

        <h2 id="contrast">Contrast</h2>
        <p>
          A contrast cell shows the pair in its own colors, its WCAG 2.2 ratio cut to two decimals and its
          level for normal text: AA from 4.5:1 and AAA from 7:1. A translucent foreground is composited over
          its surface first, as the browser paints it. A cell below AA is tinted, and the footer counts them.
        </p>
        <p>
          The <strong>text-grade pairs</strong> are the pairs Fuse&apos;s contrast gate holds at 4.5:1 in
          every theme and scheme, so a theme that fails one does not build. The{" "}
          <strong>other role pairs</strong> are each remaining role with a <code>-foreground</code> drawn on
          it and the pairs the token contract names beside them. The gate does not hold them, so some sit
          below AA. <code>feature-foreground</code> is decorative, and the{" "}
          <Link href="/accessibility#accepted-deviations">accessibility page</Link> lists the other deviations
          Fuse accepts. To see a theme&apos;s pairs in context, open the{" "}
          <Link href="/handbook/theme-matrix">theme matrix</Link>.
        </p>
      </div>
    </DocsPage>
  );
}
