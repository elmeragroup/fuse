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
 * Each brand's Fuse logo, whose `mark` variant is the symbol without its name. Fjordkraft Företag
 * carries Fjordkraft's, as Fuse's `BrandLogo` maps it.
 */
export const BRAND_LOGOS = {
  elma: ElmeraGroupLogo,
  fkas: FjordkraftLogo,
  fkab: FjordkraftLogo,
  tkas: TrondelagkraftLogo,
  guen: GudbrandsdalEnergiLogo,
  fkse: TelinetLogo,
  ngfi: NordicGreenEnergyLogo,
} satisfies Record<BrandCode, (props: LogoProps) => ReactElement>;

/** Paints every shape of an inline logo in the surrounding text colour. */
export const CURRENT_INK =
  "[&_circle]:fill-current [&_path]:fill-current [&_polygon]:fill-current [&_rect]:fill-current";

/**
 * A mark's box: the caller sets its height and the artwork keeps its proportions. In one ink, every
 * shape takes the surrounding text colour; in colour, the artwork keeps the brand's own fills.
 */
const brandMark = tv({
  base: "inline-flex shrink-0 *:h-full *:w-auto",
  variants: {
    ink: {
      current: CURRENT_INK,
      artwork: "",
    },
  },
});

/** Props for {@link BrandMark}. */
export type BrandMarkProps = {
  readonly brand: BrandCode;
  /** One ink in the current text colour, or the artwork's own colours. One ink by default. */
  readonly ink?: "current" | "artwork";
  /** Sets the box's height and place. */
  readonly className?: string;
};

/**
 * A brand's mark, named for assistive technology. It renders inline SVG, so it paints in the frame
 * that mounts it, with nothing to load.
 *
 * @returns The mark.
 */
export function BrandMark({ brand, ink = "current", className }: BrandMarkProps): ReactElement {
  const Mark = BRAND_LOGOS[brand];
  return (
    <span role="img" aria-label={BRANDS[brand].displayName} className={brandMark({ ink, className })}>
      <Mark variant="mark" />
    </span>
  );
}
