import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../../components/DocsPage";
import { ThemeMatrix } from "../../../../components/ThemeMatrix";

const HREF = "/handbook/theme-matrix";

export const metadata = pageMetadata(HREF);

export default function ThemeMatrixPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <p>
        Every cell below renders the same components. Nothing in the markup names a brand — each cell is
        wrapped in a <code>ThemeScope</code> carrying one theme coordinate, and the cascade does the rest.
        That is the whole whitelabel argument in one screen.
      </p>
      <p>
        There are twenty cells because there are twenty legal permutations: two variants × six brands × two
        segments, minus the four the pin table forbids. <code>fkab</code> is pinned to <code>company</code>{" "}
        and <code>fkse</code> to <code>private</code>, so <code>*-fkab-private</code> and{" "}
        <code>*-fkse-company</code> are not expressible — they are absent here rather than drawn and crossed
        out. See <Link href="/handbook/brands-and-segments">Brands &amp; segments</Link>.
      </p>
      <p>
        Density is not an axis of this grid. It is a colour grid, and the document root of this site stays{" "}
        <code>dense</code> throughout.
      </p>

      <ThemeMatrix />

      <h2 id="overlays">Overlays stay in their cell</h2>
      <p>
        Open the <strong>Overlay</strong> button in any cell. The popup is portalled, and a portal rendered
        outside its themed scope would silently take the page&apos;s theme instead. It does not: overlay
        components default their portal container to the nearest <code>ThemeScope</code> element, so the popup
        lands inside the cell that opened it and is painted in that cell&apos;s colours. An explicit{" "}
        <code>container</code> prop still overrides that when an app needs it.
      </p>
    </DocsPage>
  );
}
