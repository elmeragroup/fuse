import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Wcag from "@elmeragroup/color/wcag";

export const BOOTSTRAP_MANIFEST_KEY = "__ELMERA_COLOR_SCHEME_BOOTSTRAP__";
export const INJECTED_BOOTSTRAP_SOURCE_KEY = "elmera.colorScheme.bootstrapSource";

export const DOCUMENT_BRAND = {
  variant: "internal",
  brand: "elma",
  segment: "private",
} as const;

export const EXPECTED_BOOTSTRAP_MANIFEST = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
  forcedColorScheme: undefined,
} as const;

export const EXPECTED_FORCED_DARK_MANIFEST = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
  forcedColorScheme: "dark",
} as const;

export type DocumentBrand = {
  variant: string | null;
  brand: string | null;
  segment: string | null;
};

export type ColorSchemeBootstrapManifest = {
  storageKey: string;
  defaultColorScheme: string;
  enableSystem: boolean;
  forcedColorScheme: string | undefined;
};

export function openTag(html: string, tagName: string): string | null {
  const match = new RegExp(`<${tagName}\\b[^>]*>`, "i").exec(html);
  return match?.[0] ?? null;
}

export function tagAttribute(open: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(open);
  return match?.[1] ?? null;
}

export function readDocumentBrand(html: string): DocumentBrand {
  const htmlTag = openTag(html, "html");
  if (htmlTag === null) {
    return { variant: null, brand: null, segment: null };
  }
  return {
    variant: tagAttribute(htmlTag, "data-theme-variant"),
    brand: tagAttribute(htmlTag, "data-theme-brand"),
    segment: tagAttribute(htmlTag, "data-theme-segment"),
  };
}

export function readDocumentDensity(html: string): string | null {
  const htmlTag = openTag(html, "html");
  if (htmlTag === null) {
    return null;
  }
  return tagAttribute(htmlTag, "data-density");
}

export function inlineScripts(html: string): Array<{ start: number; attrs: string; source: string }> {
  const scripts: Array<{ start: number; attrs: string; source: string }> = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match = pattern.exec(html);
  while (match) {
    const attrs = match[1] ?? "";
    if (!/\ssrc\s*=/i.test(attrs)) {
      scripts.push({
        start: match.index,
        attrs,
        source: match[2] ?? "",
      });
    }
    match = pattern.exec(html);
  }
  return scripts;
}

export function isHostBootstrapSource(source: string): boolean {
  return (
    source.includes(BOOTSTRAP_MANIFEST_KEY) &&
    source.includes("document.documentElement.setAttribute") &&
    !source.includes(INJECTED_BOOTSTRAP_SOURCE_KEY)
  );
}

export function bootstrapScripts(html: string): Array<{ start: number; attrs: string; source: string }> {
  return inlineScripts(html).filter((script) => isHostBootstrapSource(script.source));
}

export function moduleScriptIndex(html: string): number {
  const match = /<script\b[^>]*\btype=(["'])module\1[^>]*>/i.exec(html);
  return match?.index ?? -1;
}

export function stylesheetLinks(html: string): Array<{ start: number; href: string | null }> {
  const links: Array<{ start: number; href: string | null }> = [];
  const pattern = /<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>/gi;
  let match = pattern.exec(html);
  while (match) {
    links.push({
      start: match.index,
      href: /\shref=(["'])([^"']*)\1/i.exec(match[0])?.[2] ?? null,
    });
    match = pattern.exec(html);
  }
  return links;
}

export function definesCssCustomProperty(cssText: string, propertyName: string): boolean {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*:`).test(cssText);
}

export function resolveDocumentHref(documentPath: string, href: string): string {
  const pathname = href.split("?")[0] ?? href;
  if (pathname.startsWith("/")) {
    return path.join(path.dirname(documentPath), pathname.slice(1));
  }
  return path.resolve(path.dirname(documentPath), pathname);
}

export function tokenBackgroundDefinitionIndex(html: string, documentPath: string): number {
  let earliest = -1;

  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch = stylePattern.exec(html);
  while (styleMatch) {
    if (definesCssCustomProperty(styleMatch[1] ?? "", "--background")) {
      if (earliest === -1 || styleMatch.index < earliest) {
        earliest = styleMatch.index;
      }
    }
    styleMatch = stylePattern.exec(html);
  }

  for (const link of stylesheetLinks(html)) {
    if (link.href === null) {
      continue;
    }
    const cssPath = resolveDocumentHref(documentPath, link.href);
    if (!existsSync(cssPath)) {
      continue;
    }
    const css = readFileSync(cssPath, "utf8");
    if (!definesCssCustomProperty(css, "--background")) {
      continue;
    }
    if (earliest === -1 || link.start < earliest) {
      earliest = link.start;
    }
  }

  return earliest;
}

export function isClassicScript(attrs: string): boolean {
  if (/\ssrc\s*=/i.test(attrs)) {
    return false;
  }
  const type = /\stype=(["'])([^"']*)\1/i.exec(attrs)?.[2];
  if (type === undefined || type === "" || type === "text/javascript" || type === "application/javascript") {
    return true;
  }
  return false;
}

// The first-paint suites call a canvas light when its relative luminance is at least that of
// CIE L* 99. Chromium computes the light themes' background as `rgb(255, 255, 255)`,
// `oklch(1 0 0)` or a `lab()` lightness near 100, and all three pass. The check reads
// luminance rather than a notation's lightness, so a tinted near-white such as
// `oklch(1 0.05 30)` does not count. CIE L* 99 is Y = ((99 + 16) / 116) ^ 3 ≈ 0.9744 by the
// CIE L* definition above L* 8, and WCAG relative luminance is that Y for a neutral color.
const NEAR_WHITE_LUMINANCE = ((99 + 16) / 116) ** 3;

// The conversion from `lab(99 0 0)` to sRGB and back to luminance lands a float step below
// that Y, so the comparison allows 1e-9 of rounding. L* 98.9 sits 0.0025 lower and fails.
const LUMINANCE_ROUNDING = 1e-9;

// The first-paint suites call a canvas dark when its relative luminance is at most that of
// CIE L* 20, Y = ((20 + 16) / 116) ^ 3 ≈ 0.0299 by the CIE L* definition above L* 8. Every
// theme's dark background sits below 0.009, so the line leaves room for palette changes while
// a transparent, missing or unreadable canvas still fails.
const NEAR_BLACK_LUMINANCE = ((20 + 16) / 116) ** 3;

/**
 * Classify a computed canvas color by the scheme it paints. A canvas is light when it is
 * opaque with a relative luminance at least that of CIE L* 99, and dark when it is opaque with
 * a relative luminance at most that of CIE L* 20. A translucent color, an empty value, a
 * notation the color parser does not read, or a luminance between the two lines is neither.
 *
 * @param color - A computed color, such as the body's `background-color`.
 * @returns `"light"` or `"dark"` for a painted canvas of that scheme, otherwise `undefined`.
 */
export function canvasScheme(color: string): "light" | "dark" | undefined {
  const parsed = CssColor.parse(color.trim());
  if (parsed._tag === "err") {
    return undefined;
  }
  const canvas = CssColor.toSrgb(parsed.value);
  if (canvas.alpha !== 1) {
    return undefined;
  }
  const luminance = Wcag.relativeLuminance(canvas);
  if (luminance >= NEAR_WHITE_LUMINANCE - LUMINANCE_ROUNDING) {
    return "light";
  }
  if (luminance <= NEAR_BLACK_LUMINANCE) {
    return "dark";
  }
  return undefined;
}
