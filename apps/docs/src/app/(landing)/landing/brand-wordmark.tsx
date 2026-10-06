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
      elma: "landing-logo-elma aspect-465/58",
      fkas: "landing-logo-fkas aspect-257/54",
      fkab: "landing-logo-fkab aspect-416/54",
      tkas: "landing-logo-tkas aspect-534/88",
      guen: "landing-logo-guen aspect-461/124",
      fkse: "landing-logo-fkse aspect-260/35",
      ngfi: "landing-logo-ngfi aspect-461/201",
    } satisfies Record<BrandCode, string>,
    // `tile` captions a brand tile; `strip` is the hero's row, a step larger from `sm`; `site`
    // takes its height from a demo site's logo slot.
    size: { tile: "", strip: "", site: "" },
  },
  compoundVariants: [
    { brand: "elma", size: "tile", class: "h-4" },
    { brand: "fkas", size: "tile", class: "h-5" },
    { brand: "fkab", size: "tile", class: "h-5" },
    { brand: "tkas", size: "tile", class: "h-4.5" },
    { brand: "guen", size: "tile", class: "h-7" },
    { brand: "fkse", size: "tile", class: "h-4.5" },
    { brand: "ngfi", size: "tile", class: "h-8" },
    { brand: "elma", size: "strip", class: "sm:h-4.5 h-3.5" },
    { brand: "fkas", size: "strip", class: "sm:h-6 h-4.5" },
    { brand: "fkab", size: "strip", class: "sm:h-6 h-4.5" },
    { brand: "tkas", size: "strip", class: "sm:h-5 h-4" },
    { brand: "guen", size: "strip", class: "sm:h-8 h-6" },
    { brand: "fkse", size: "strip", class: "sm:h-5 h-4" },
    { brand: "ngfi", size: "strip", class: "sm:h-9 h-7" },
  ],
  defaultVariants: { size: "tile" },
});

export type BrandWordmarkProps = {
  brand: BrandCode;
  size?: "tile" | "strip" | "site";
};

export function BrandWordmark({ brand, size }: BrandWordmarkProps): ReactElement {
  return (
    <span role="img" aria-label={BRANDS[brand].displayName} className={brandWordmark({ brand, size })} />
  );
}
