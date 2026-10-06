import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { BRANDS } from "../theme/tokens/themes";
import type { BrandCode } from "../theme/tokens/themes";
import type { LogoProps } from "./bespoke-svg";
import { FjordkraftLogo } from "./bespoke/fjordkraft-logo";
import { GudbrandsdalEnergiLogo } from "./bespoke/gudbrandsdal-energi-logo";
import { NordicGreenEnergyLogo } from "./bespoke/nordic-green-energy-logo";
import { TelinetLogo } from "./bespoke/telinet-logo";
import { TrondelagkraftLogo } from "./bespoke/trondelagkraft-logo";

export type BrandLogoProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  brand: BrandCode;
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

export function BrandLogo({
  brand,
  variant = "full",
  title,
  "aria-label": ariaLabel,
  ...rest
}: BrandLogoProps): ReactElement {
  // SAFETY: BrandCode is a compile-time contract; a JS consumer can pass an unknown code.
  const displayName = (BRANDS as Record<string, (typeof BRANDS)[BrandCode] | undefined>)[brand]?.displayName;
  if (displayName === undefined) {
    throw new Error(`Unhandled brand: ${String(brand)}`);
  }
  const Mark = BRAND_MARKS[brand];
  return (
    <span aria-label={ariaLabel ?? title ?? displayName} {...rest} data-variant={variant} role="img">
      {Mark === null ? displayName : <Mark variant={variant} />}
    </span>
  );
}
