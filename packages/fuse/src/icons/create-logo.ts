import { createElement } from "react";
import type { ComponentType, ReactElement } from "react";

import type { BespokeSvgProps, LogoProps } from "./bespoke-svg";

export function createLogo(
  Full: ComponentType<BespokeSvgProps>,
  Mark: ComponentType<BespokeSvgProps>,
  name: string
): (props: LogoProps) => ReactElement {
  function Logo({ variant = "full", ...props }: LogoProps): ReactElement {
    return createElement(variant === "mark" ? Mark : Full, props);
  }
  Logo.displayName = name;
  return Logo;
}
