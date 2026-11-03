import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import type { LogoProps } from "@elmeragroup/fuse/icons";
import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { BRAND_LOGOS, CURRENT_INK } from "./brand-mark";
import { FjordkraftForetagLogo } from "./fjordkraft-foretag-logo";

/**
 * Each brand's full logo, as the landing's brand strip uses them. Fuse has no Fjordkraft Företag
 * logo, so that brand draws the landing's artwork.
 */
const WORDMARKS = {
  ...BRAND_LOGOS,
  fkab: FjordkraftForetagLogo,
} satisfies Record<BrandCode, (props: LogoProps) => ReactElement>;

/**
 * A brand's logo in one ink, the surrounding text colour. The aspect ratios and optical heights
 * are the landing's `brand-wordmark.tsx` strip values, so every lockup carries the same weight.
 */
const brandWordmark = tv({
  base: ["inline-block max-w-full shrink-0 *:block *:size-full", CURRENT_INK],
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
  },
});

/**
 * A brand's full logo in the current text colour, named for assistive technology. It renders
 * inline SVG, so it paints in the frame that mounts it, with nothing to load.
 *
 * @param props.brand - The brand.
 * @returns The logo.
 */
export function BrandWordmark({ brand }: { readonly brand: BrandCode }): ReactElement {
  const Logo = WORDMARKS[brand];
  return (
    <span role="img" aria-label={BRANDS[brand].displayName} className={brandWordmark({ brand })}>
      <Logo />
    </span>
  );
}
