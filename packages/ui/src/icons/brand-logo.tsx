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
  // SAFETY: BrandCode is a compile-time contract; a JS consumer can pass an unknown code.
  const displayName = (BRANDS as Record<string, (typeof BRANDS)[BrandCode] | undefined>)[brand]?.displayName;
  if (displayName === undefined) {
    throw new Error(`Unhandled brand: ${String(brand)}`);
  }
  return (
    <span {...rest} className={className} data-variant={variant} role="img" aria-label={title ?? displayName}>
      {displayName}
    </span>
  );
}
