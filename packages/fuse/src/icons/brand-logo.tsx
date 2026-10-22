import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { cn } from "../styles/cn";
import { BRANDS } from "../theme/tokens/themes";
import type { BrandCode } from "../theme/tokens/themes";
import type { LogoProps } from "./bespoke-svg";
import { FjordkraftLogo } from "./bespoke/fjordkraft-logo";
import { GudbrandsdalEnergiLogo } from "./bespoke/gudbrandsdal-energi-logo";
import { NordicGreenEnergyLogo } from "./bespoke/nordic-green-energy-logo";
import { TelinetLogo } from "./bespoke/telinet-logo";
import { TrondelagkraftLogo } from "./bespoke/trondelagkraft-logo";

/** Props for {@link BrandLogo}: the brand, the variant, and props for the wrapping span. */
export type BrandLogoProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  /** The brand whose logo to draw. */
  brand: BrandCode;
  /** `"full"`, the default, draws the whole logo; `"mark"` draws the symbol alone. */
  variant?: "full" | "mark";
  /** Accessible name. Defaults to the brand display name; an explicit `aria-label` wins. */
  title?: string;
};

const BRAND_MARKS = {
  fkas: FjordkraftLogo,
  fkab: FjordkraftLogo,
  tkas: TrondelagkraftLogo,
  guen: GudbrandsdalEnergiLogo,
  fkse: TelinetLogo,
  elma: null,
  ngfi: NordicGreenEnergyLogo,
} satisfies Record<BrandCode, ((props: LogoProps) => ReactElement) | null>;

// The ngfi and fkse svgs have a viewBox but no width or height, so the clamp below would collapse
// them to 0×0 in a span nobody sizes. They fall back to their viewBox extent.
const MARK_FALLBACK_SIZES = {
  fkas: null,
  fkab: null,
  tkas: null,
  guen: null,
  fkse: { width: 83.397, height: 64.796 },
  elma: null,
  ngfi: { width: 203, height: 199 },
} satisfies Record<BrandCode, { readonly width: number; readonly height: number } | null>;

/**
 * A brand's logo in a span named as an image. A brand without artwork renders its display name.
 *
 * A `size-*` class in `className` sizes a mark. An unsized mark takes the icon size of the menu
 * row or button it sits in, and its artwork size elsewhere. A full logo keeps an inline span that
 * a size class can't reach, so size it through a class that targets its svg.
 *
 * @param props - The brand, the variant, the accessible name, and props for the span.
 * @returns The logo, named by `aria-label`, then `title`, then the brand display name.
 * @throws When a JavaScript caller passes a brand code outside {@link BrandCode}.
 */
export function BrandLogo({
  brand,
  variant = "full",
  title,
  "aria-label": ariaLabel,
  className,
  ...rest
}: BrandLogoProps): ReactElement {
  // SAFETY: BrandCode is a compile-time contract; a JS consumer can pass an unknown code.
  const displayName = (BRANDS as Record<string, (typeof BRANDS)[BrandCode] | undefined>)[brand]?.displayName;
  if (displayName === undefined) {
    throw new Error(`Unhandled brand: ${String(brand)}`);
  }
  const Mark = BRAND_MARKS[brand];
  const drawsMark = Mark !== null && variant === "mark";
  // A drawn mark's svg is clamped to its span in both directions, so a caller who sizes the span
  // sizes the artwork. The clamp holds no `size-` class, so a menu row's or button's icon rule
  // still sizes an unsized mark. `shrink-0` keeps Firefox and WebKit from shrinking the span to
  // 0px wide in a cramped row, because the clamped svg adds no min-content width. Chromium keeps
  // the width either way, so no Chromium test can catch its loss. Without preflight, `inline-flex`
  // would beat the user agent's `[hidden]` rule, so the span re-applies it.
  return (
    <span
      aria-label={ariaLabel ?? title ?? displayName}
      className={cn(
        drawsMark && "inline-flex shrink-0 [&[hidden]:not([hidden=until-found])]:hidden",
        className
      )}
      {...rest}
      data-variant={variant}
      role="img">
      {Mark === null ? (
        displayName
      ) : drawsMark ? (
        <Mark
          variant="mark"
          className="max-h-full min-h-full max-w-full min-w-full"
          {...MARK_FALLBACK_SIZES[brand]}
        />
      ) : (
        <Mark variant={variant} />
      )}
    </span>
  );
}
