import type { ReactElement } from "react";

import { decorativeSvgProps } from "../bespoke-svg";
import type { BespokeSvgProps } from "../bespoke-svg";

export function TrondelagkraftLogoMark({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg
      width="238"
      height="284"
      viewBox="0 0 238 284"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"

      {...decorativeSvgProps(title)}
      {...props}>
      {title ? <title>{title}</title> : null}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M69.6918 243.151H168.167V217.177H69.6918V243.151Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M69.6936 282.118H168.167V256.146H69.6936V282.118Z"
        fill="white"
      />
      <mask
        id="trondelagkraft-logo-mark-mask0"
        maskUnits="userSpaceOnUse"
        x="22"
        y="0"
        width="194"
        height="205">
        <path fillRule="evenodd" clipRule="evenodd" d="M22.3125 0H215.547V204.871H22.3125V0Z" fill="white" />
      </mask>
      <g mask="url(#trondelagkraft-logo-mark-mask0)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M118.93 175.031C81.8439 175.031 51.7846 144.869 51.7846 107.656C51.7846 70.454 81.8439 40.2917 118.93 40.2917C156.015 40.2917 186.075 70.454 186.075 107.656C186.075 144.869 156.015 175.031 118.93 175.031ZM191.644 44.1266L208.149 18.1009L179.243 -0.000976562L156.768 18.6901C145.15 13.728 132.357 10.9727 118.93 10.9727C65.5635 10.9727 22.3125 54.3718 22.3125 107.921C22.3125 161.472 65.5635 204.871 118.93 204.871C172.296 204.871 215.547 161.472 215.547 107.921C215.547 83.4862 206.518 61.1684 191.644 44.1266Z"
          fill="white"
        />
      </g>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M118.93 151.45C94.8211 151.45 75.2867 131.849 75.2867 107.658C75.2867 83.4773 94.8211 63.8672 118.93 63.8672C143.028 63.8672 162.573 83.4773 162.573 107.658C162.573 131.849 143.028 151.45 118.93 151.45Z"
        fill="#FFF400"
      />
    </svg>
  );
}
