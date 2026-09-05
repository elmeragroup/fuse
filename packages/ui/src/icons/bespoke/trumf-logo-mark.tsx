import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function TrumfLogoMark({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"

      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path
        data-name="trumf-background"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 48H0V23.9266C0 10.7123 10.7451 0 24 0H24C37.2549 0 48 10.7123 48 23.9266V24.0734C48 37.2877 37.2549 48 24 48Z"
        fill="currentColor"
      />
      <path
        data-name="trumf-text"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.3729 30.3837V21.5232H18.2808C17.2193 21.5232 16.2453 20.7874 16.0433 19.7149C15.7686 18.2561 16.8373 16.9883 18.2034 16.9883H18.3729V14.7509C18.3729 13.3948 19.3205 12.1818 20.6289 12.0199C22.1958 11.8259 23.5254 13.0775 23.5254 14.6512V16.9883H25.7191C26.7807 16.9883 27.7547 17.7242 27.9567 18.7967C28.2314 20.2556 27.1627 21.5232 25.7966 21.5232H23.5254V29.5116C23.5254 30.7325 24.0339 31.3255 25.1864 31.3255C25.3559 31.3255 25.6949 31.2907 25.7966 31.2907C26.9491 31.2907 27.9321 32.2674 27.9321 33.4884C27.9321 34.4302 27.322 35.1976 26.6102 35.4767C25.661 35.8605 24.7796 36 23.661 36C20.5085 36 18.3729 34.7093 18.3729 30.3837Z"
        fill="white"
      />
    </svg>
  );
}
