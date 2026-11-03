import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { PaletteInspector } from "../../../../components/palette-inspector/palette-inspector";

const HREF = "/handbook/palettes";

export const metadata = pageMetadata(HREF);

export default function PalettesPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <p>
        A theme stores finished values, one per role, rather than tonal ramps. The inspector below reads those
        values for one theme in one color scheme and shows three things: the distinct tones the roles resolve
        to, which roles share each tone, and the contrast of each foreground on the surface it is drawn on.
      </p>
      <p>
        It opens on the theme the header picker previews, and picking a theme here moves that picker too. The
        values are generated from the same resolved theme catalog that the{" "}
        <Link href="/handbook/tokens">token reference</Link> and the Figma export read, so they match the CSS
        that <code>themes.css</code> ships.
      </p>

      <h2 id="inspector">Inspector</h2>
      <p>
        <strong>Default</strong> lists every tone from darkest to lightest, then every color role by group,
        then every graded pair. Hover or focus a swatch to read its OKLCH and hex values, and press it to copy
        the OKLCH value. While a tone or a role is in focus, the roles on other tones fade, so the roles that
        share it stand out. <strong>Detailed</strong> lists every role in a table you can search by name or
        value, filter by group, by shared tone and by contrast level, and sort by name or by its weakest pair.
      </p>

      <PaletteInspector />

      <h2 id="tones">Tones</h2>
      <p>
        A tone is a distinct color, and two roles share a tone when they resolve to the same color. Many do: a
        card is often the page&apos;s own white, and one dark neutral can serve as the primary fill, the
        accent text and the feature text. When a product needs a color the theme does not have, as the
        Gudbrandsdal Energi sidebar did, the tones here show what the theme does hold. Use a role that
        resolves to the tone you need, never its literal value, so the product follows the theme when the tone
        moves.
      </p>

      <h2 id="contrast">Contrast</h2>
      <p>
        Ratios are WCAG 2.2 contrast ratios between the two resolved colors. A translucent foreground is
        composited over its surface first, as the browser paints it. AA for normal text is 4.5:1 and AAA is
        7:1.
      </p>
      <p>
        The <strong>text-grade pairs</strong> are the pairs Fuse&apos;s contrast gate holds at 4.5:1 in every
        theme and scheme, so a theme that fails one does not build. The <strong>other role pairs</strong> are
        each remaining role with a <code>-foreground</code> drawn on it. The gate does not hold them, so some
        sit below AA, and the inspector marks each one that does. <code>feature-foreground</code> is
        decorative, and the <Link href="/accessibility#accepted-deviations">accessibility page</Link> lists
        the other deviations Fuse accepts. Before you set text in a pair below AA, check it there. To see a
        theme&apos;s pairs in context, open the <Link href="/handbook/theme-matrix">theme matrix</Link>.
      </p>
    </DocsPage>
  );
}
