import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

/**
 * A brand's full logo in one ink: the monochrome artwork is a mask and `bg-current` fills it,
 * so the logo takes the surrounding text colour in every brand and scheme. Fuse's own logo
 * components keep the brands' fixed colours, which disappear on a light card.
 * Heights are optical: a two-line lockup needs more height to carry the same weight.
 */
const brandWordmark = tv({
  // Every tile is wide enough for the widest lockup at its height; the width cap is only a guard,
  // so a tile that ever gets narrower scales the artwork down instead of overflowing its slot.
  base: "inline-block max-w-full shrink-0 bg-current mask-contain mask-center mask-no-repeat",
  variants: {
    brand: {
      elma: "landing-logo-elma aspect-465/58 h-4",
      fkas: "landing-logo-fkas aspect-257/54 h-5",
      fkab: "landing-logo-fkab aspect-416/54 h-5",
      tkas: "landing-logo-tkas aspect-534/88 h-4.5",
      guen: "landing-logo-guen aspect-461/124 h-7",
      fkse: "landing-logo-fkse aspect-260/35 h-4.5",
    } satisfies Record<BrandCode, string>,
  },
});

export type BrandWordmarkProps = {
  brand: BrandCode;
};

export function BrandWordmark({ brand }: BrandWordmarkProps): ReactElement {
  return <span role="img" aria-label={BRANDS[brand].displayName} className={brandWordmark({ brand })} />;
}
