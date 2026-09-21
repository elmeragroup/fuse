import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function DeviateLogo({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"

      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M80 0V17.6552C61.8851 17.6552 48.9239 27.6961 48.9195 40.0839C48.9195 40.0866 48.9195 40.0893 48.9195 40.092V57.931H31.2644V39.908H31.2648C31.3638 17.8505 48.9195 0 80 0Z"
        fill="currentColor"
      />
      <path
        d="M48.9195 71.1724C48.9195 76.0478 44.9673 80 40.092 80C35.2166 80 31.2644 76.0478 31.2644 71.1724C31.2644 66.2971 35.2166 62.3448 40.092 62.3448C44.9673 62.3448 48.9195 66.2971 48.9195 71.1724Z"
        fill="currentColor"
      />
      <path
        d="M31.9232 20.9034C23.571 17.637 17.6552 9.50937 17.6552 0H0C1.53202e-06 17.5243 11.2434 32.4225 26.9101 37.8745C27.2404 31.7507 28.9405 25.9926 31.9232 20.9034Z"
        fill="currentColor"
      />
    </svg>
  );
}
