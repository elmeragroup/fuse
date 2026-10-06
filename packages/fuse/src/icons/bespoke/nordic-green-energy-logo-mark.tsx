import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

/**
 * The Nordic Green Energy mark: the five-leaf symbol without the wordmark, in fixed brand colors.
 * A nonempty `title` names it as an image; without one it renders decorative.
 *
 * @param props - SVG props, plus the optional accessible `title`.
 * @returns The mark as an SVG.
 */
export function NordicGreenEnergyLogoMark({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      viewBox="0 0 203 199"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path
        d="M61.4993 94.4501C62.5099 111.368 47.7611 125.137 30.8121 125.137C13.8631 125.137 1.17236 111.368 0.124889 94.4501C-2.28587 55.5884 30.8121 34.5285 47.0084 30.4807C31.9911 58.7572 59.9518 68.4949 61.4993 94.4501Z"
        fill="#A79BAF"
      />
      <path
        d="M80.3959 139.223C96.7975 143.492 105.335 161.772 100.098 177.89C94.8605 194.007 77.843 201.818 61.4309 197.592C23.7272 187.875 13.9262 149.892 15.079 133.238C37.3338 156.256 55.2303 132.675 80.3959 139.223Z"
        fill="#73BEE2"
      />
      <path
        d="M128.816 134.812C137.944 120.532 157.967 118.063 171.678 128.022C185.39 137.986 187.559 156.582 178.469 170.884C157.577 203.745 118.421 201.324 102.94 195.081C131.706 181.032 114.815 156.719 128.816 134.812Z"
        fill="#FA5C5F"
      />
      <path
        d="M139.649 87.8652C128.89 74.7745 132.727 54.962 146.439 45.0032C160.151 35.0391 178.511 38.7236 189.301 51.7933C214.098 81.8173 199.697 118.31 188.97 131.101C184.496 99.3979 156.156 107.957 139.644 87.8652H139.649Z"
        fill="#F3CD20"
      />
      <path
        d="M98.4608 62.6469C82.6856 68.837 65.0312 59.0624 59.7939 42.945C54.5565 26.8277 63.7311 10.505 79.4958 4.27809C115.71 -10.0233 145.965 14.9476 154.819 29.0963C123.284 23.5537 122.663 53.1513 98.4608 62.6469Z"
        fill="#63B67B"
      />
    </svg>
  );
}
