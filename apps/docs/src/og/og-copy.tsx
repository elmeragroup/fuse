import type { ReactElement } from "react";

import { css } from "./og-theme";
import type { OgTheme } from "./og-theme";

/** What the title block draws. */
type OgCopyProps = {
  readonly theme: OgTheme;
  readonly title: string;
  readonly lede: string;
  /** The title size for a short title; long ones step down so they keep to two lines. */
  readonly titleSize?: number;
  /** How many lines the lede may take before it is clamped with an ellipsis. */
  readonly ledeLines?: number;
};

const LONG_TITLE = 12;

/**
 * The title and lede every docs and component image sets the same way: a tight semibold title of
 * at least 64px over a muted lede of 28px, legible at link-preview width.
 */
export function OgCopy({ theme, title, lede, titleSize = 80, ledeLines = 3 }: OgCopyProps): ReactElement {
  const size = title.length > LONG_TITLE ? Math.max(64, titleSize - 16) : titleSize;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <span
        style={{
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.04,
          letterSpacing: "-0.025em",
          color: css(theme.colors.foreground),
        }}>
        {title}
      </span>
      <span
        style={{
          fontSize: 28,
          lineHeight: 1.36,
          color: css(theme.colors["muted-foreground"]),
          display: "block",
          lineClamp: ledeLines,
        }}>
        {lede}
      </span>
    </div>
  );
}
