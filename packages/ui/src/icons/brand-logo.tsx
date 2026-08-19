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
  switch (brand) {
    case "fkas":
    case "fkab":
    case "tkas":
    case "guen":
    case "fkse":
    case "elma": {
      const displayName = BRANDS[brand].displayName;
      return (
        <span
          {...rest}
          className={className}
          data-variant={variant}
          role="img"
          aria-label={title ?? displayName}>
          {displayName}
        </span>
      );
    }
    default: {
      const _exhaustive: never = brand;
      void _exhaustive;
      throw new Error("Unhandled brand");
    }
  }
}
