import { createElement } from "react";
import type { ComponentProps, ReactElement } from "react";

import type { Check } from "@phosphor-icons/react/dist/ssr/Check";

export type ElmeraIconProps = Omit<ComponentProps<typeof Check>, "weight"> & {
  weight?: "regular" | "fill";
};

export function createElmeraIcon(Icon: typeof Check, name: string): (props: ElmeraIconProps) => ReactElement {
  function ElmeraIcon({ weight = "regular", ...props }: ElmeraIconProps): ReactElement {
    return createElement(Icon, { ...props, weight });
  }
  ElmeraIcon.displayName = name;
  return ElmeraIcon;
}
