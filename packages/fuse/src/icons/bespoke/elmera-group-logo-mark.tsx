import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function ElmeraGroupLogoMark({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      width="33"
      height="37"
      viewBox="0 0 33 37"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"

      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path d="M32.9882 0H0V7.90127H32.9882V0Z" fill="currentColor" />
      <path d="M18.746 14.2121H0V22.1134H18.746V14.2121Z" fill="currentColor" />
      <path d="M32.9882 18.1596H25.0703V28.4243H0V36.3193H32.9882V28.4243V18.1596Z" fill="currentColor" />
    </svg>
  );
}
