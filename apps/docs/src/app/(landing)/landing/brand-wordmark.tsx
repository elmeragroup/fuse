import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import {
  ElmeraGroupLogo,
  FjordkraftLogo,
  GudbrandsdalEnergiLogo,
  NordicGreenEnergyLogo,
  TelinetLogo,
  TrondelagkraftLogo,
} from "@elmeragroup/fuse/icons";
import type { LogoProps } from "@elmeragroup/fuse/icons";
import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

/**
 * Each brand's full Fuse logo. Fuse has no Fjordkraft Företag logo, so that brand stays a mask of
 * monochrome artwork in `public/landing/logos/`, filled by `bg-current`.
 */
const FUSE_WORDMARKS = {
  elma: ElmeraGroupLogo,
  fkas: FjordkraftLogo,
  fkab: null,
  tkas: TrondelagkraftLogo,
  guen: GudbrandsdalEnergiLogo,
  fkse: TelinetLogo,
  ngfi: NordicGreenEnergyLogo,
} satisfies Record<BrandCode, ((props: LogoProps) => ReactElement) | null>;

/**
 * A brand's full logo in one ink, the surrounding text colour, in every brand and scheme.
 * Heights are optical: a two-line lockup needs more height to carry the same weight. Elmera's,
 * Fjordkraft's and Telinet's viewBoxes pad their artwork by about 6%, so those heights are a
 * quarter step above the ink they carry.
 */
const brandWordmark = tv({
  // Every tile is wide enough for the widest lockup at its height; the width cap is only a guard,
  // so a tile that ever gets narrower scales the artwork down instead of overflowing its slot.
  base: "inline-block max-w-full shrink-0",
  variants: {
    brand: {
      elma: "aspect-470/62",
      fkas: "aspect-307/68",
      fkab: "landing-logo-fkab aspect-416/54",
      tkas: "aspect-534/88",
      guen: "aspect-193/52",
      fkse: "aspect-655/93",
      ngfi: "aspect-461/202",
    } satisfies Record<BrandCode, string>,
    art: {
      // Fuse logos keep their brand-coloured marks. A fill from CSS beats both a presentation
      // attribute and a `url(#gradient)` paint, so every shape here takes the text colour. These
      // are the shape elements the Fuse logo artwork draws with.
      svg: "*:block *:size-full [&_path]:fill-current [&_polygon]:fill-current [&_rect]:fill-current",
      mask: "bg-current mask-contain mask-center mask-no-repeat",
    },
    // `tile` captions a brand tile; `strip` is the hero's row, a step larger from `sm`; `site`
    // takes its height from a demo site's logo slot.
    size: { tile: "", strip: "", site: "" },
  },
  compoundVariants: [
    { brand: "elma", size: "tile", class: "h-4.25" },
    { brand: "fkas", size: "tile", class: "h-5.25" },
    { brand: "fkab", size: "tile", class: "h-5" },
    { brand: "tkas", size: "tile", class: "h-4.5" },
    { brand: "guen", size: "tile", class: "h-7" },
    { brand: "fkse", size: "tile", class: "h-4.75" },
    { brand: "ngfi", size: "tile", class: "h-8" },
    { brand: "elma", size: "strip", class: "sm:h-4.75 h-3.75" },
    { brand: "fkas", size: "strip", class: "sm:h-6.5 h-4.75" },
    { brand: "fkab", size: "strip", class: "sm:h-6 h-4.5" },
    { brand: "tkas", size: "strip", class: "sm:h-5 h-4" },
    { brand: "guen", size: "strip", class: "sm:h-8 h-6" },
    { brand: "fkse", size: "strip", class: "sm:h-5.25 h-4.25" },
    { brand: "ngfi", size: "strip", class: "sm:h-9 h-7" },
  ],
  defaultVariants: { size: "tile" },
});

export type BrandWordmarkProps = {
  brand: BrandCode;
  size?: "tile" | "strip" | "site";
};

export function BrandWordmark({ brand, size }: BrandWordmarkProps): ReactElement {
  const Logo = FUSE_WORDMARKS[brand];
  return (
    <span
      role="img"
      aria-label={BRANDS[brand].displayName}
      className={brandWordmark({ brand, size, art: Logo === null ? "mask" : "svg" })}>
      {Logo === null ? null : <Logo />}
    </span>
  );
}
