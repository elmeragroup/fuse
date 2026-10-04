/**
 * Bespoke art for the handbook pages with a strong visual idea, keyed by page href. Each draws
 * into the docs image's 496 × 430 art box. A page without an entry draws the shared chart steps.
 */

import type { ReactElement } from "react";

import {
  ArrowsClockwise,
  Bell,
  CalendarBlank,
  Check,
  CreditCard,
  Download,
  Envelope,
  Eye,
  Flag,
  Gear,
  House,
  Info,
  Lightning,
  MagnifyingGlass,
  MapPin,
  Phone,
  Plus,
  Trash,
  User,
  Warning,
} from "@elmeragroup/fuse/icons";
import {
  BRAND_CODES,
  LEGAL_THEMES,
  THEME_SEGMENTS,
  THEME_VARIANTS,
  themeSlug,
} from "@elmeragroup/fuse/theme";
import type { BrandCode, ThemeSegment } from "@elmeragroup/fuse/theme";

import { LANDING_FACTS } from "../generated/landing-facts";
import type { OgColorRole } from "../generated/og-themes";
import { SEGMENT_LABELS } from "../lib/theme";
import { ART_BOX } from "./docs-image";
import type { DocsArt, OgDocsHref } from "./docs-pages";
import { loadBrandArtwork } from "./og-assets";
import { glyph } from "./og-icons";
import { css, ogTheme } from "./og-theme";
import type { OgTheme } from "./og-theme";

/** One theme as a cell: its background, a primary button at its own radius, three role chips. */
function MatrixCell({ theme }: { readonly theme: OgTheme }): ReactElement {
  const { colors } = theme;
  const chip = (role: OgColorRole) => (
    <div key={role} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: css(colors[role]) }} />
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: 90,
        height: 98,
        padding: 12,
        borderRadius: Math.min(16, theme.dimensions.radius + 4),
        border: `2px solid ${css(colors.border)}`,
        backgroundColor: css(colors.background),
      }}>
      <div style={{ display: "flex", gap: 5 }}>{(["brand", "feature", "secondary"] as const).map(chip)}</div>
      <div
        style={{
          display: "flex",
          height: 26,
          width: 64,
          borderRadius: Math.min(13, theme.dimensions["radius-button"]),
          backgroundColor: css(colors.primary),
        }}
      />
    </div>
  );
}

/** Theme matrix: the twenty legal themes as cells, internal rows over external rows. */
const themeMatrix: DocsArt = () => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignContent: "center",
      gap: 10,
      width: ART_BOX.width,
      height: ART_BOX.height,
    }}>
    {LEGAL_THEMES.map((theme) => (
      <MatrixCell key={themeSlug(theme)} theme={ogTheme(themeSlug(theme))} />
    ))}
  </div>
);

/** Brands & segments: each brand's mark per segment, in its external palette; pinned gaps stay empty. */
const brandsAndSegments: DocsArt = async (docs) => {
  const cells = await Promise.all(
    THEME_SEGMENTS.flatMap((segment) =>
      BRAND_CODES.map(async (brand) => {
        const legal = LEGAL_THEMES.find(
          (theme) => theme.variant === "external" && theme.brand === brand && theme.segment === segment
        );
        if (legal === undefined) {
          return { brand, segment, theme: null, mark: null };
        }
        const theme = ogTheme(themeSlug(legal));
        const mark = await loadBrandArtwork(brand, "marks", css(theme.colors.primary));
        return { brand, segment, theme, mark };
      })
    )
  );
  const row = (segment: ThemeSegment) => (
    <div key={segment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 24, fontWeight: 500, color: css(docs.colors["muted-foreground"]) }}>
        {SEGMENT_LABELS[segment]}
      </span>
      <div style={{ display: "flex", gap: 10 }}>
        {cells
          .filter((cell) => cell.segment === segment)
          .map(
            ({
              brand,
              theme,
              mark,
            }: {
              brand: BrandCode;
              theme: OgTheme | null;
              mark: { src: string; aspect: number } | null;
            }) =>
              theme === null || mark === null ? (
                <div
                  key={brand}
                  style={{
                    display: "flex",
                    width: 74,
                    height: 124,
                    borderRadius: 14,
                    border: `2px dashed ${css(docs.colors.border)}`,
                  }}
                />
              ) : (
                <div
                  key={brand}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 74,
                    height: 124,
                    borderRadius: 14,
                    backgroundColor: css(theme.colors["primary-soft"]),
                  }}>
                  <img
                    src={mark.src}
                    width={Math.round(Math.min(44, 44 * mark.aspect))}
                    height={Math.round(Math.min(44, 44 * mark.aspect) / mark.aspect)}
                    alt=""
                  />
                </div>
              )
          )}
      </div>
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 28,
        width: ART_BOX.width,
        height: ART_BOX.height,
      }}>
      {THEME_SEGMENTS.map(row)}
    </div>
  );
};

const ICONS = Object.entries({
  House,
  User,
  Bell,
  Envelope,
  Phone,
  CalendarBlank,
  MagnifyingGlass,
  Gear,
  Lightning,
  CreditCard,
  Download,
  Trash,
  Plus,
  Check,
  Info,
  Warning,
  Flag,
  MapPin,
  Eye,
  ArrowsClockwise,
});

/** Icons: twenty glyphs from the curated Phosphor roster, at one stroke weight. */
const icons: DocsArt = (docs) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignContent: "center",
      gap: 10,
      width: ART_BOX.width,
      height: ART_BOX.height,
    }}>
    {ICONS.map(([name, Icon], index) => (
      <div
        key={name}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 90,
          height: 90,
          borderRadius: 16,
          border: `2px solid ${css(docs.colors.border)}`,
          backgroundColor: index === 8 ? css(docs.colors.primary) : css(docs.colors.background),
        }}>
        {glyph(Icon)(44, index === 8 ? css(docs.colors["primary-foreground"]) : css(docs.colors.foreground))}
      </div>
    ))}
  </div>
);

const TOKEN_ROWS = [
  "primary",
  "card",
  "border",
  "ring",
  "success",
  "warning",
] as const satisfies readonly OgColorRole[];

/** Tokens: role tokens as swatch rows, named as the contract spells them. */
const tokens: DocsArt = (docs) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 12,
      width: ART_BOX.width,
      height: ART_BOX.height,
    }}>
    {TOKEN_ROWS.map((role) => (
      <div
        key={role}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          height: 58,
          padding: "0 18px",
          borderRadius: 14,
          border: `2px solid ${css(docs.colors.border)}`,
          backgroundColor: css(docs.colors.background),
        }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: css(docs.colors[role]),
            border: `2px solid ${css(docs.colors.foreground, 0.12)}`,
          }}
        />
        <span
          style={{ fontSize: 28, fontWeight: 500, color: css(docs.colors.foreground) }}>{`--${role}`}</span>
      </div>
    ))}
  </div>
);

/** Theming: the three axes as segmented choices, resolving to one theme painted in its primary. */
const theming: DocsArt = (docs) => {
  const picked = { variant: "external", brand: "tkas", segment: "company" } as const;
  const result = ogTheme(themeSlug(picked));
  const axis = (label: string, options: readonly string[], selected: string) => (
    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 24, fontWeight: 500, color: css(docs.colors["muted-foreground"]) }}>
        {label}
      </span>
      <div
        style={{
          display: "flex",
          padding: 4,
          gap: 4,
          borderRadius: 14,
          backgroundColor: css(docs.colors.muted),
          border: `2px solid ${css(docs.colors.border)}`,
        }}>
        {options.map((option) => (
          <span
            key={option}
            style={{
              display: "flex",
              alignItems: "center",
              height: 44,
              padding: "0 11px",
              borderRadius: 10,
              fontSize: 24,
              fontWeight: 500,
              backgroundColor: option === selected ? css(result.colors.primary) : "transparent",
              color:
                option === selected ? css(result.colors["primary-foreground"]) : css(docs.colors.foreground),
            }}>
            {option}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 22,
        width: ART_BOX.width,
        height: ART_BOX.height,
      }}>
      {axis("Variant", THEME_VARIANTS, picked.variant)}
      {axis("Brand", BRAND_CODES, picked.brand)}
      {axis("Segment", THEME_SEGMENTS, picked.segment)}
    </div>
  );
};

/** A fixed date, so the art never depends on the clock. */
const SAMPLE_DATE = new Date(Date.UTC(2026, 2, 14, 12));

/** Localization: one date in every supported locale, formatted by `Intl` as the components do. */
const localization: DocsArt = (docs) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 12,
      width: ART_BOX.width,
      height: ART_BOX.height,
    }}>
    {LANDING_FACTS.locales.map((locale) => (
      <div
        key={locale}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 78,
          padding: "0 24px",
          borderRadius: 16,
          border: `2px solid ${css(docs.colors.border)}`,
          backgroundColor: css(docs.colors.background),
        }}>
        <span style={{ fontSize: 30, fontWeight: 500, color: css(docs.colors.foreground) }}>
          {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(SAMPLE_DATE)}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            height: 38,
            padding: "0 12px",
            borderRadius: 10,
            backgroundColor: css(docs.colors.muted),
            fontSize: 24,
            fontWeight: 500,
            color: css(docs.colors["muted-foreground"]),
          }}>
          {locale}
        </span>
      </div>
    ))}
  </div>
);

/** The pages with bespoke art, by href; a renamed or removed page fails to compile. */
type ArtByHref = { readonly [H in OgDocsHref]?: DocsArt };

/** Bespoke art by page href. */
const ART_BY_HREF: ArtByHref = {
  "/handbook/theme-matrix": themeMatrix,
  "/handbook/brands-and-segments": brandsAndSegments,
  "/handbook/icons": icons,
  "/handbook/tokens": tokens,
  "/handbook/theming": theming,
  "/handbook/localization": localization,
};

/**
 * The bespoke art of a docs page.
 *
 * @param href - A docs page route.
 * @returns The page's art, or `undefined` when it draws the shared chart steps.
 */
export function docsArt(href: OgDocsHref): DocsArt | undefined {
  return ART_BY_HREF[href];
}
