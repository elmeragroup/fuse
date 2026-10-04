import type { ReactElement } from "react";

import type { ArtworkImage } from "./og-assets";
import { OgCopy } from "./og-copy";
import { chartBand, OG_INSET, OgFrame } from "./og-frame";
import type { OgKind } from "./og-frame";
import { css } from "./og-theme";
import type { OgTheme } from "./og-theme";

/** What a docs page image draws. */
export type DocsImageProps = {
  readonly theme: OgTheme;
  readonly mark: ArtworkImage;
  readonly kind: OgKind;
  readonly title: string;
  readonly lede: string;
  /**
   * Bespoke art for the right half, drawn in a 500 × 430 box. Without it the image draws the
   * shared art, a rising run of the docs theme's chart colors.
   */
  readonly art?: ReactElement;
};

/** The box bespoke art draws into, right of the copy column. */
export const ART_BOX = { left: 632, top: 132, width: 496, height: 430 } as const;

/** The shared art: the eight chart colors as rising bars, the docs theme's own data ramp. */
function ChartSteps({ theme }: { readonly theme: OgTheme }): ReactElement {
  const { colors } = theme;
  const ramp = [
    colors["chart-1"],
    colors["chart-2"],
    colors["chart-3"],
    colors["chart-4"],
    colors["chart-5"],
    colors["chart-6"],
    colors["chart-7"],
    colors["chart-8"],
  ];
  return (
    <div
      style={{
        position: "absolute",
        right: OG_INSET.x,
        bottom: 76,
        display: "flex",
        alignItems: "flex-end",
        gap: 14,
      }}>
      {ramp.map((color, index) => (
        <div
          key={css(color)}
          style={{
            width: 34,
            height: 72 + index * 38,
            borderRadius: 17,
            backgroundColor: css(color),
          }}
        />
      ))}
    </div>
  );
}

/**
 * A docs page's image. With bespoke art the copy keeps the left column and the art takes the
 * right; without it the copy spans the width over the shared chart steps.
 */
export function DocsImage({ theme, mark, kind, title, lede, art }: DocsImageProps): ReactElement {
  const backdrop =
    art === undefined ? (
      <ChartSteps theme={theme} />
    ) : (
      <div
        style={{
          position: "absolute",
          left: ART_BOX.left,
          top: ART_BOX.top,
          width: ART_BOX.width,
          height: ART_BOX.height,
          display: "flex",
        }}>
        {art}
      </div>
    );
  return (
    <OgFrame theme={theme} mark={mark} kind={kind} band={chartBand(theme)} backdrop={backdrop}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: art === undefined ? 700 : ART_BOX.left - 24,
          padding: `0 0 ${String(OG_INSET.bottom)}px ${String(OG_INSET.x)}px`,
        }}>
        <OgCopy
          theme={theme}
          title={title}
          lede={lede}
          titleSize={art === undefined ? 88 : 80}
          ledeLines={art === undefined ? 3 : 4}
        />
      </div>
    </OgFrame>
  );
}
