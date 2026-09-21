import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function OrderLogo({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      width="80"
      height="94"
      viewBox="0 0 80 94"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"

      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.8073 52.6052C66.6615 48.5934 80 32.6434 80 13.578H62.3853C62.3853 25.9411 52.3631 35.9633 40 35.9633C27.6369 35.9633 17.6147 25.9411 17.6147 13.578H0C0 32.6434 13.3385 48.5934 31.1927 52.6052V93.3945L48.8073 72.844V52.6052Z"
        fill="currentColor"
      />
      <path
        d="M46.789 6.78899C46.789 10.5384 43.7495 13.578 40 13.578C36.2505 13.578 33.211 10.5384 33.211 6.78899C33.211 3.03953 36.2505 0 40 0C43.7495 0 46.789 3.03953 46.789 6.78899Z"
        fill="currentColor"
      />
      <path
        d="M46.789 24.7706C46.789 28.5201 43.7495 31.5596 40 31.5596C36.2505 31.5596 33.211 28.5201 33.211 24.7706C33.211 21.0212 36.2505 17.9817 40 17.9817C43.7495 17.9817 46.789 21.0212 46.789 24.7706Z"
        fill="currentColor"
      />
    </svg>
  );
}
