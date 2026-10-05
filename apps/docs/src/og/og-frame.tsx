import type { ReactElement, ReactNode } from "react";

import type { ArtworkImage } from "./og-assets";
import { OG_FONT_FAMILY } from "./og-assets";
import { css } from "./og-theme";
import type { OgTheme } from "./og-theme";

// Satori draws only inline styles, so the OG modules style elements inline; `.oxlintrc.json`
// turns `shadcn/no-inline-styles` off for `src/og/` and `src/app/og/` alone.

/** Every OG image is a 1200 × 630 PNG, the size Open Graph and X large cards crop to. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** The inset every family keeps from the image edge, so the lockups align across the set. */
export const OG_INSET = { x: 72, top: 60, bottom: 64 } as const;

/** What a page is, shown top right in every image so the set reads as one family. */
export type OgKind = "Component" | "Handbook" | "Guide";

/** What the frame needs to draw the family lockup. */
export type OgFrameProps = {
  /** The theme the image paints in. */
  readonly theme: OgTheme;
  /** The Elmera mark, inked in the theme's foreground. */
  readonly mark: ArtworkImage;
  /** The pill top right: an `OgKind` on docs pages; the landing names its variant and segment. */
  readonly kind: string;
  /** The colors of the signature band along the bottom edge, from the theme's own palette. */
  readonly band: readonly string[];
  /** A full-bleed layer under the content, such as a texture from the theme's colors. */
  readonly backdrop?: ReactNode;
  /** The body under the lockup row. */
  readonly children: ReactNode;
};

const MARK_HEIGHT = 34;
const BAND_HEIGHT = 12;

/** The docs theme's band: its eight chart colors, the data ramp every docs page shares. */
export function chartBand(theme: OgTheme): readonly string[] {
  const { colors } = theme;
  return [
    colors["chart-1"],
    colors["chart-2"],
    colors["chart-3"],
    colors["chart-4"],
    colors["chart-5"],
    colors["chart-6"],
    colors["chart-7"],
    colors["chart-8"],
  ].map((color) => css(color));
}

/**
 * The family frame: the theme's background, the Fuse lockup top left, the page kind top right
 * and a band of theme colors along the bottom edge, at the same coordinates in every image.
 * The body fills the rest.
 */
export function OgFrame({ theme, mark, kind, band, backdrop, children }: OgFrameProps): ReactElement {
  const { colors } = theme;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        backgroundColor: css(colors.background),
        color: css(colors.foreground),
        fontFamily: OG_FONT_FAMILY,
      }}>
      {backdrop}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${String(OG_INSET.top)}px ${String(OG_INSET.x)}px 0`,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={mark.src} width={Math.round(MARK_HEIGHT * mark.aspect)} height={MARK_HEIGHT} alt="" />
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em" }}>Fuse</span>
        </div>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            height: 46,
            padding: "0 20px",
            borderRadius: 23,
            border: `2px solid ${css(colors.border)}`,
            backgroundColor: css(colors.background),
            fontSize: 24,
            fontWeight: 500,
            color: css(colors["muted-foreground"]),
          }}>
          {kind}
        </span>
      </div>
      <div style={{ position: "relative", display: "flex", flexGrow: 1, minHeight: 0 }}>{children}</div>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: OG_SIZE.width,
          height: BAND_HEIGHT,
          backgroundImage: `linear-gradient(to right, ${band.join(", ")})`,
        }}
      />
    </div>
  );
}
