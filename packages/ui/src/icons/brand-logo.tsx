import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { BRANDS } from "../theme/tokens/themes";
import type { BrandCode } from "../theme/tokens/themes";

export type BrandLogoProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  brand: BrandCode;
  variant?: "full" | "mark";
};

export function BrandLogo({
  brand,
  variant = "full",
  title,
  className,
  ...rest
}: BrandLogoProps): ReactElement {
  const displayName = BRANDS[brand].displayName;
  return (
    <span {...rest} className={className} data-variant={variant} role="img" aria-label={title ?? displayName}>
      {displayName}
    </span>
  );
}
