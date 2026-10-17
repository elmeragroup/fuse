import type { ReactElement } from "react";

import { staticFile } from "remotion";
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
 * Each brand's full Fuse logo, as the landing's brand strip uses them. Fuse has no Fjordkraft
 * Företag logo, so that brand is a mask of the landing's monochrome artwork in `public/logos/`.
 */
const FUSE_LOGOS = {
  elma: ElmeraGroupLogo,
  fkas: FjordkraftLogo,
  fkab: null,
  tkas: TrondelagkraftLogo,
  guen: GudbrandsdalEnergiLogo,
  fkse: TelinetLogo,
  ngfi: NordicGreenEnergyLogo,
} satisfies Record<BrandCode, ((props: LogoProps) => ReactElement) | null>;

/**
 * A brand's logo in one ink, the surrounding text colour. The aspect ratios and optical heights
 * are the landing's `brand-wordmark.tsx` strip values, so every lockup carries the same weight.
 */
const brandWordmark = tv({
  base: "inline-block max-w-full shrink-0",
  variants: {
    brand: {
      elma: "aspect-470/62 h-4.75",
      fkas: "aspect-307/68 h-6.5",
      fkab: "aspect-416/54 h-6",
      tkas: "aspect-534/88 h-5",
      guen: "aspect-193/52 h-8",
      fkse: "aspect-655/93 h-5.25",
      ngfi: "aspect-461/202 h-9",
    } satisfies Record<BrandCode, string>,
    art: {
      svg: "*:block *:size-full [&_path]:fill-current [&_polygon]:fill-current [&_rect]:fill-current",
      mask: "bg-current mask-contain mask-center mask-no-repeat",
    },
  },
});

/**
 * A brand's full logo in the current text colour, named for assistive technology.
 *
 * @param props.brand - The brand.
 * @returns The logo.
 */
export function BrandWordmark({ brand }: { readonly brand: BrandCode }): ReactElement {
  const Logo = FUSE_LOGOS[brand];
  return (
    <span
      role="img"
      aria-label={BRANDS[brand].displayName}
      className={brandWordmark({ brand, art: Logo === null ? "mask" : "svg" })}
      style={Logo === null ? { maskImage: `url(${staticFile(`logos/${brand}.svg`)})` } : undefined}>
      {Logo === null ? null : <Logo />}
    </span>
  );
}
