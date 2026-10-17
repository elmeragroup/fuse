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
 * Each brand's mark, the symbol without its name, from Fuse's logos. Fjordkraft Företag carries
 * Fjordkraft's mark, as Fuse's `BrandLogo` maps it.
 */
const MARKS = {
  elma: ElmeraGroupLogo,
  fkas: FjordkraftLogo,
  fkab: FjordkraftLogo,
  tkas: TrondelagkraftLogo,
  guen: GudbrandsdalEnergiLogo,
  fkse: TelinetLogo,
  ngfi: NordicGreenEnergyLogo,
} satisfies Record<BrandCode, (props: LogoProps) => ReactElement>;

/**
 * A mark's box: the caller sets its height and the artwork keeps its proportions. In one ink, every
 * shape takes the surrounding text colour; in colour, the artwork keeps the brand's own fills.
 */
const brandMark = tv({
  base: "inline-flex shrink-0 *:h-full *:w-auto",
  variants: {
    ink: {
      current: "[&_circle]:fill-current [&_path]:fill-current [&_polygon]:fill-current [&_rect]:fill-current",
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
  const Mark = MARKS[brand];
  return (
    <span role="img" aria-label={BRANDS[brand].displayName} className={brandMark({ ink, className })}>
      <Mark variant="mark" />
    </span>
  );
}
