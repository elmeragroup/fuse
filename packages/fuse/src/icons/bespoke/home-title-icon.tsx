import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function HomeTitleIcon({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      width={76}
      height={60}
      viewBox="0 0 76 60"
      xmlns="http://www.w3.org/2000/svg"
      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}

      <path
        d="M51.5068 0.0625C64.8283 0.0625 75.6279 10.8622 75.6279 24.1836V35.8135C75.6279 49.1349 64.8283 59.9346 51.5068 59.9346C50.2648 59.9346 49.0449 59.8393 47.8535 59.6582C57.1426 55.6878 63.6611 46.3946 63.6611 35.5625V24.4346C63.6611 13.6027 57.1433 4.3084 47.8545 0.337891C49.0456 0.156946 50.2652 0.0625191 51.5068 0.0625Z"
        fill="#F8D0BA"
      />
      <path
        d="M18.5195 6.96484C14.4015 11.5961 11.8955 17.7205 11.8955 24.4365V35.5645C11.8955 42.2804 14.4015 48.4049 18.5195 53.0361H18.5039C8.28473 53.0361 0 44.7524 0 34.5332V25.4678C0 15.2487 8.28477 6.96484 18.5039 6.96484H18.5195Z"
        fill="#FFF7F2"
      />
      <rect x={13.6992} y={0} width={48.1587} height={60} rx={24.0794} fill="#F5AA81" />
      <path
        d="M28.1992 41.6669H33.7763V31.7631H42.6221V41.6669H48.1992V26.6669L38.1992 19.1348L28.1992 26.6669V41.6669ZM25.6992 44.1669V25.4169L38.1992 16.0098L50.6992 25.4169V44.1669H40.1221V34.2631H36.2763V44.1669H25.6992Z"
        fill="#390C00"
      />
    </svg>
  );
}
