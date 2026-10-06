import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import type { BrandCode } from "@elmeragroup/fuse/theme";

/**
 * A brand's mark in one ink, as a mask filled by `bg-current`, so it takes the surrounding text
 * colour: the foreground on a resting tile, `primary-foreground` on the picked one, the sidebar's
 * brand foreground in the demo's workspace switcher. It is the same artwork the closing shader
 * traces. Decorative: the tile's wordmark or the switcher's label names the brand.
 */
const brandMark = tv({
  base: "inline-block shrink-0 bg-current mask-contain mask-center mask-no-repeat",
  variants: {
    brand: {
      elma: "landing-mark-elma aspect-32988/36319",
      fkas: "landing-mark-fkas aspect-176/215",
      fkab: "landing-mark-fkab aspect-176/215",
      tkas: "landing-mark-tkas aspect-81191/118212",
      guen: "landing-mark-guen aspect-22632/22300",
      fkse: "landing-mark-fkse aspect-32559/25118",
      ngfi: "landing-mark-ngfi aspect-203/199",
    } satisfies Record<BrandCode, string>,
    // `tile` fills a brand picker tile; `icon` sits in a 16px icon slot, as in a menu item.
    size: { tile: "sm:h-16 h-18", icon: "h-4" },
  },
  defaultVariants: { size: "tile" },
});

export type BrandMarkProps = {
  brand: BrandCode;
  size?: "tile" | "icon";
  className?: string;
};

export function BrandMark({ brand, size, className }: BrandMarkProps): ReactElement {
  return <span aria-hidden className={brandMark({ brand, size, className })} />;
}
