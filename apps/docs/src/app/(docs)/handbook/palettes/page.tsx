import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { PaletteInspector } from "../../../../components/palette-inspector";

const HREF = "/handbook/palettes";

export const metadata = pageMetadata(HREF);

const palettesPage = tv({
  slots: {
    // The page is wide for the tables; its prose keeps the docs' reading measure.
    measure: "max-w-[39rem]",
  },
});

const { measure } = palettesPage();

export default function PalettesPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <div className={measure()}>
        <p>
          The tables below show each brand&apos;s palettes, which color roles point at them, and how each role
          pair measures against WCAG AA. Every table has one column per brand. The switches above them set the
          identity, segment and color scheme for every column. A brand with one segment, such as Telinet,
          shows a hatched cell for the other.
        </p>
      </div>

      <PaletteInspector />

      <div className={measure()}>
        <h2 id="brand-palettes">Brand palettes</h2>
        <p>
          Every theme carries three ramps of eleven steps: <code>--brand-neutral-50</code> to{" "}
          <code>--brand-neutral-950</code>, a grey tinted with the brand hue, and the brand palettes{" "}
          <code>--brand-1-*</code> and <code>--brand-2-*</code>. They are tokens like the roles, so{" "}
          <code>bg-brand-1-600</code> and <code>text-brand-neutral-900</code> work. A ramp changes with the
          brand and segment, and stays the same across identities and color schemes.
        </p>
        <p>
          Every ramp comes from the same recipe: each step sits at a lightness every brand shares. A brand
          palette passes through a color the brand already curates, its seed, at the step nearest the
          seed&apos;s lightness, and the table marks that step. Palette 1 is seeded by the brand color.
          Telinet and Gudbrandsdal Energi curate a second color, which seeds palette 2. Every other brand has
          one color, so each step of its palette 2 points at the same step of palette 1. See{" "}
          <Link href="/handbook/theming">Theming</Link> for how a product uses a step.
        </p>

        <h2 id="roles">Roles</h2>
        <p>
          A role cell shows the role&apos;s color. An arrow names the token the role points at, such as a
          neutral <code>--dialog</code> at <code>popover</code> or a branded <code>--muted</code> at{" "}
          <code>brand-neutral-100</code>. An equals sign names a ramp step whose color the role holds without
          pointing at it, such as <code>--feature</code>, the seed of palette 1. Use a role where one exists,
          so the product follows the theme, and a ramp step for a tone no role has.
        </p>

        <h2 id="contrast">Contrast</h2>
        <p>
          A contrast cell shows the pair in its own colors, its WCAG 2.2 ratio truncated to two decimals and
          its level for normal text: AA from 4.5:1 and AAA from 7:1. The grade reads the ratio at full
          precision, so a pair never rounds up to AA. A translucent foreground is composited over its surface
          first, as the browser paints it.
        </p>
        <p>
          The <strong>text-grade pairs</strong> are the pairs Fuse&apos;s contrast gate holds at 4.5:1 in
          every theme and scheme. A theme that fails one does not build. The <strong>other role pairs</strong>{" "}
          are each remaining role with its <code>-foreground</code> on top, plus the pairs the token contract
          names. Fuse&apos;s contrast tests hold some of them to a floor of their own and leave the rest
          unchecked, so some fall below AA. <code>feature-foreground</code> is decorative, and the{" "}
          <Link href="/accessibility#accepted-deviations">accessibility page</Link> lists the other deviations
          Fuse accepts. To see a theme&apos;s pairs in context, open the{" "}
          <Link href="/handbook/theme-matrix">theme matrix</Link>.
        </p>
      </div>
    </DocsPage>
  );
}
