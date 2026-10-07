import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Monitor, Moon, Sun } from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";
import { COLOR_SCHEMES } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";

const GLYPHS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const satisfies Record<ColorScheme, (props: ElmeraIconProps) => ReactElement>;

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
  const Glyph = GLYPHS[scheme];
  return <Glyph className={styles.glyph()} />;
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
