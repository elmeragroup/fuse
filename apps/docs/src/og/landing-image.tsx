import type { ReactElement } from "react";

import { SEGMENT_LABELS, VARIANT_LABELS } from "../lib/theme";
import type { ArtworkImage } from "./og-assets";
import { OG_INSET, OG_SIZE, OgFrame } from "./og-frame";
import { css } from "./og-theme";
import type { OgTheme } from "./og-theme";

/** What the landing image draws. */
export type LandingImageProps = {
  /** The theme the shared landing address opens in. */
  readonly theme: OgTheme;
  /** The Elmera mark, inked in the theme's foreground. */
  readonly mark: ArtworkImage;
  /**
   * The theme brand's compact mark, drawn large as the backdrop: inked in `--feature` for an
   * external theme, and in `--brand` for an internal one, whose palette is grayscale apart from
   * brand accents.
   */
  readonly brandMark: ArtworkImage;
  /** The theme brand's full logo, inked in the foreground. */
  readonly brandLogo: ArtworkImage;
  /** The one-sentence summary the landing hero and metadata share. */
  readonly summary: string;
};

const MARK_BOX = { width: 540, height: 500 } as const;
const LOGO_BOX = { width: 300, height: 44 } as const;

/**
 * The landing's image in the theme its address names: the brand's logo as the eyebrow, the hero
 * headline with its second line in the theme's primary as on the page, the summary, and the
 * brand's mark drawn large off the right edge. The kind pill names the variant and segment.
 */
export function LandingImage({
  theme,
  mark,
  brandMark,
  brandLogo,
  summary,
}: LandingImageProps): ReactElement {
  const { colors } = theme;
  const markHeight = Math.round(Math.min(MARK_BOX.height, MARK_BOX.width / brandMark.aspect));
  const markWidth = Math.round(markHeight * brandMark.aspect);
  const logoHeight = Math.round(Math.min(LOGO_BOX.height, LOGO_BOX.width / brandLogo.aspect));
  const logoWidth = Math.round(logoHeight * brandLogo.aspect);
  const backdrop = (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          backgroundImage: `radial-gradient(circle at 88% 70%, ${css(colors["primary-soft"])} 0%, ${css(colors.background)} 62%)`,
        }}
      />
      <img
        src={brandMark.src}
        width={markWidth}
        height={markHeight}
        alt=""
        style={{
          position: "absolute",
          right: -Math.round(markWidth * 0.16),
          top: Math.round(390 - markHeight / 2),
          opacity: 0.9,
        }}
      />
    </>
  );
  const kind = `${VARIANT_LABELS[theme.variant]} · ${SEGMENT_LABELS[theme.segment]}`;
  // An internal palette is grayscale, so its band runs from the primary into the brand accent.
  const band =
    theme.variant === "internal"
      ? [css(colors.primary), css(colors.brand)]
      : [css(colors.primary), css(colors.feature), css(colors["feature-bright"])];
  return (
    <OgFrame theme={theme} mark={mark} kind={kind} band={band} backdrop={backdrop}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: OG_SIZE.width,
          padding: `0 ${String(OG_INSET.x)}px ${String(OG_INSET.bottom)}px`,
          gap: 28,
        }}>
        <img src={brandLogo.src} width={logoWidth} height={logoHeight} alt="" style={{ marginBottom: 8 }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 104,
            fontWeight: 600,
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
          }}>
          <span style={{ color: css(colors.foreground) }}>One system.</span>
          <span style={{ color: css(colors.primary) }}>Every brand.</span>
        </div>
        <span
          style={{ maxWidth: 640, fontSize: 28, lineHeight: 1.36, color: css(colors["muted-foreground"]) }}>
          {summary}
        </span>
      </div>
    </OgFrame>
  );
}
