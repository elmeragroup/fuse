import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function SteddiLogoGlyph({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      width="30"
      height="33"
      viewBox="0 0 56 74"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"

      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path
        d="M42.5 57.5L47 54L56 64L49.628 69.7938C45.9623 73.3038 40.3227 73.5069 36.4596 70.2289L26.5 62L12 74L4 63L26.5 44L42.5 57.5Z"
        fill="currentColor"
      />
      <path d="M0 28H53V38H0V28Z" fill="currentColor" />
      <circle cx="28" cy="11" r="11" fill="currentColor" />
    </svg>
  );
}
