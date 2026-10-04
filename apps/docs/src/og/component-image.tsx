import type { ReactElement } from "react";

import type { ComponentPageEntry } from "../lib/docs-model";
import type { ArtworkImage } from "./og-assets";
import { OgCopy } from "./og-copy";
import { chartBand, OG_INSET, OgFrame } from "./og-frame";
import { css } from "./og-theme";
import type { OgTheme } from "./og-theme";

/** The demo frame on the right; the copy column ends where it starts. */
const FRAME = { left: 604, top: 136, width: 524, height: 426, caption: 60 } as const;

/** What a component image draws. */
export type ComponentImageProps = {
  readonly theme: OgTheme;
  readonly mark: ArtworkImage;
  readonly component: ComponentPageEntry;
  /** The specimen, already drawn at its scale. */
  readonly specimen: ReactElement;
  /** The variant and state the specimen shows, set in the frame's caption row. */
  readonly caption: string;
};

/**
 * A component page's image: the title and lede on the left, and on the right a demo frame like
 * the docs page's own, a stage over a faint grid holding one specimen and a caption row naming
 * the variant it shows.
 */
export function ComponentImage({
  theme,
  mark,
  component,
  specimen,
  caption,
}: ComponentImageProps): ReactElement {
  const { colors } = theme;
  const line = css(colors.border, 0.5);
  const frame = (
    <div
      style={{
        position: "absolute",
        left: FRAME.left,
        top: FRAME.top,
        width: FRAME.width,
        height: FRAME.height,
        display: "flex",
        flexDirection: "column",
        borderRadius: 24,
        border: `2px solid ${css(colors.border)}`,
        backgroundColor: css(colors.background),
        overflow: "hidden",
      }}>
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          minHeight: 0,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: `linear-gradient(to right, ${line} 2px, transparent 2px), linear-gradient(to bottom, ${line} 2px, transparent 2px)`,
          backgroundSize: "40px 40px",
          backgroundPosition: "-1px -1px",
        }}>
        {specimen}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: FRAME.caption,
          flexShrink: 0,
          padding: "0 24px",
          borderTop: `2px solid ${css(colors.border)}`,
          backgroundColor: css(colors["card-soft"]),
          fontSize: 24,
          color: css(colors["muted-foreground"]),
        }}>
        {caption}
      </div>
    </div>
  );
  return (
    <OgFrame theme={theme} mark={mark} kind="Component" band={chartBand(theme)} backdrop={frame}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: FRAME.left,
          padding: `0 48px ${String(OG_INSET.bottom)}px ${String(OG_INSET.x)}px`,
        }}>
        <OgCopy theme={theme} title={component.title} lede={component.lede} />
      </div>
    </OgFrame>
  );
}
