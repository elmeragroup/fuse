import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function FunnelLogo({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"

      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.8073 39.0192C66.6615 35.0081 80 19.0614 80 0H62.3853C62.3853 12.3605 52.3631 22.3807 40 22.3807C27.6369 22.3807 17.6147 12.3605 17.6147 0H0C0 19.0614 13.3385 35.0081 31.1927 39.0192V79.8L48.8073 59.2538V39.0192Z"
        fill="currentColor"
      />
    </svg>
  );
}
