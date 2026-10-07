import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { COLOR_SCHEMES } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";

/**
 * Phosphor's bold Sun, Moon and Monitor (MIT), the set and default weight of Fuse's icons. Fuse
 * ships none of the three yet (TODO.md), so the landing draws them from the same 256-unit paths.
 */
const GLYPHS = {
  light:
    "M116,36V20a12,12,0,0,1,24,0V36a12,12,0,0,1-24,0Zm80,92a68,68,0,1,1-68-68A68.07,68.07,0,0,1,196,128Zm-24,0a44,44,0,1,0-44,44A44.05,44.05,0,0,0,172,128ZM51.51,68.49a12,12,0,1,0,17-17l-12-12a12,12,0,0,0-17,17Zm0,119-12,12a12,12,0,0,0,17,17l12-12a12,12,0,1,0-17-17ZM196,72a12,12,0,0,0,8.49-3.51l12-12a12,12,0,0,0-17-17l-12,12A12,12,0,0,0,196,72Zm8.49,115.51a12,12,0,0,0-17,17l12,12a12,12,0,0,0,17-17ZM48,128a12,12,0,0,0-12-12H20a12,12,0,0,0,0,24H36A12,12,0,0,0,48,128Zm80,80a12,12,0,0,0-12,12v16a12,12,0,0,0,24,0V220A12,12,0,0,0,128,208Zm108-92H220a12,12,0,0,0,0,24h16a12,12,0,0,0,0-24Z",
  dark: "M236.37,139.4a12,12,0,0,0-12-3A84.07,84.07,0,0,1,119.6,31.59a12,12,0,0,0-15-15A108.86,108.86,0,0,0,49.69,55.07,108,108,0,0,0,136,228a107.09,107.09,0,0,0,64.93-21.69,108.86,108.86,0,0,0,38.44-54.94A12,12,0,0,0,236.37,139.4Zm-49.88,47.74A84,84,0,0,1,68.86,69.51,84.93,84.93,0,0,1,92.27,48.29Q92,52.13,92,56A108.12,108.12,0,0,0,200,164q3.87,0,7.71-.27A84.79,84.79,0,0,1,186.49,187.14Z",
  system:
    "M208,36H48A28,28,0,0,0,20,64V176a28,28,0,0,0,28,28H208a28,28,0,0,0,28-28V64A28,28,0,0,0,208,36Zm4,140a4,4,0,0,1-4,4H48a4,4,0,0,1-4-4V64a4,4,0,0,1,4-4H208a4,4,0,0,1,4,4Zm-40,52a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h64A12,12,0,0,1,172,228Z",
} as const satisfies Record<ColorScheme, string>;

const schemeIcon = tv({
  slots: {
    glyph: "size-4 shrink-0",
    // One grid cell holds all three glyphs, so the swap never moves the label beside it.
    stack: "inline-grid size-4 shrink-0",
    stacked: "landing-icon-swap col-start-1 row-start-1",
  },
});

const styles = schemeIcon();

/** Props of `SchemeGlyph`. */
export type SchemeGlyphProps = {
  scheme: ColorScheme;
};

/** One scheme's glyph: a sun for light, a moon for dark, a monitor for the system's choice. */
export function SchemeGlyph({ scheme }: SchemeGlyphProps): ReactElement {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 256 256" fill="currentColor" className={styles.glyph()}>
      <path d={GLYPHS[scheme]} />
    </svg>
  );
}

/** Props of `SchemeIcon`. */
export type SchemeIconProps = {
  scheme: ColorScheme;
};

/**
 * The picked scheme's glyph, cross-fading from the previous one when the scheme changes.
 * Decorative: the control that carries it names the scheme.
 */
export function SchemeIcon({ scheme }: SchemeIconProps): ReactElement {
  return (
    <span aria-hidden className={styles.stack()}>
      {COLOR_SCHEMES.map((option) => (
        <span key={option} data-shown={option === scheme} className={styles.stacked()}>
          <SchemeGlyph scheme={option} />
        </span>
      ))}
    </span>
  );
}
