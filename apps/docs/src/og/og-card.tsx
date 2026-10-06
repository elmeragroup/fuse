import type { ReactElement } from "react";

import { OG_CARD_COLORS } from "../generated/og-card-colors";
import type { ArtworkImage } from "./og-assets";
import { OG_FONT_FAMILY } from "./og-assets";
import { OG_SUBTITLE_LETTER_SPACING, ogSubtitleSize } from "./og-fit";

// Satori draws only inline styles, so the OG modules style elements inline; `.oxlintrc.json`
// turns `shadcn/no-inline-styles` off for `src/og/` and `src/app/og/` alone.

/** Every OG image is a 1200 × 630 PNG, the size Open Graph and X large cards crop to. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** What the card draws. */
export type OgCardProps = {
  /** The Elmera mark, inked in the card's foreground. */
  readonly mark: ArtworkImage;
  /** The line under the lockup, such as a page label; the landing's card has none. */
  readonly subtitle?: string;
};

/**
 * The one OG card: the Fuse lockup and an optional subtitle, centred on the dark Elmera
 * background. Slack and Teams crop a link preview to the image's centre, so everything the card
 * says sits there. The mark's 102px height equals the cap height of the 144px wordmark.
 *
 * The subtitle sets at the size {@link ogSubtitleSize} fits to one 520px line. One still too wide
 * at the 44px floor wraps inside its 560px max width, breaking inside a word when it has no
 * space, and clamps to two lines.
 */
export function OgCard({ mark, subtitle }: OgCardProps): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        backgroundColor: OG_CARD_COLORS.background,
        fontFamily: OG_FONT_FAMILY,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        <img src={mark.src} width={93} height={102} alt="" />
        <span
          style={{
            fontSize: 144,
            fontWeight: 600,
            lineHeight: "144px",
            letterSpacing: "-0.02em",
            color: OG_CARD_COLORS.foreground,
          }}>
          Fuse
        </span>
      </div>
      {subtitle === undefined ? null : (
        <span
          style={{
            display: "block",
            maxWidth: 560,
            fontSize: ogSubtitleSize(subtitle),
            fontWeight: 500,
            lineHeight: "72px",
            letterSpacing: `${String(OG_SUBTITLE_LETTER_SPACING)}em`,
            textAlign: "center",
            wordBreak: "break-word",
            lineClamp: 2,
            color: OG_CARD_COLORS.mutedForeground,
          }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
