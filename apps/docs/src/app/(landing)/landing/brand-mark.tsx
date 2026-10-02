import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import type { BrandCode } from "@elmeragroup/fuse/theme";

/**
 * A brand's mark in one ink, as a mask filled by `bg-current`, so it takes the surrounding text
 * colour: the foreground on a resting tile, `primary-foreground` on the picked one. It is the
 * same artwork the closing shader traces. Decorative: the tile's wordmark names the brand.
 */
const brandMark = tv({
  base: "sm:h-16 inline-block h-18 shrink-0 bg-current mask-contain mask-center mask-no-repeat",
  variants: {
    brand: {
      elma: "landing-mark-elma aspect-32988/36319",
      fkas: "landing-mark-fkas aspect-176/215",
      fkab: "landing-mark-fkab aspect-176/215",
      tkas: "landing-mark-tkas aspect-81191/118212",
      guen: "landing-mark-guen aspect-22632/22300",
      fkse: "landing-mark-fkse aspect-32559/25118",
    } satisfies Record<BrandCode, string>,
  },
});

export type BrandMarkProps = {
  brand: BrandCode;
};

export function BrandMark({ brand }: BrandMarkProps): ReactElement {
  return <span aria-hidden className={brandMark({ brand })} />;
}
