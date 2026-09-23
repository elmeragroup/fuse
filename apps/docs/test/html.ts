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

export type DocumentBrand = {
  variant: string | null;
  brand: string | null;
  segment: string | null;
};

export type ColorSchemeBootstrapFailureSentinel = {
  manifest: undefined;
  dataTheme: null;
};

export const COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL: ColorSchemeBootstrapFailureSentinel = {
  manifest: undefined,
  dataTheme: null,
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
    !source.includes("self.__next_f")
  );
}

export function bootstrapScripts(html: string): Array<{ start: number; attrs: string; source: string }> {
  return inlineScripts(html).filter((script) => isHostBootstrapSource(script.source));
}

export function firstPaintableIndex(html: string): number {
  const bodyMatch = /<body\b[^>]*>/i.exec(html);
  const bodyStart = bodyMatch === null ? 0 : bodyMatch.index + bodyMatch[0].length;
  const body = html.slice(bodyStart);
  const skip =
    /^(?:\s+|<!--[\s\S]*?-->|<(?:script|link|style|meta|noscript|template)\b[\s\S]*?(?:\/?>|<\/(?:script|link|style|meta|noscript|template)>))/i;

  let remaining = body;
  let offset = bodyStart;
  while (remaining.length > 0) {
    const skipped = skip.exec(remaining);
    if (skipped?.index !== 0) {
      const nextTag = /<[a-z]/i.exec(remaining);
      if (nextTag?.index === undefined) {
        return -1;
      }
      return offset + nextTag.index;
    }
    const consumed = skipped[0].length;
    offset += consumed;
    remaining = remaining.slice(consumed);
  }
  return -1;
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

/**
 * Whether a computed canvas color is near white: opaque, with a relative luminance at least
 * that of CIE L* 99. A translucent color, or a notation the color parser does not read, is
 * not a painted light canvas.
 *
 * @param color - A computed color, such as the body's `background-color`.
 * @returns True when the canvas is near white.
 */
export function isLightCanvas(color: string): boolean {
  const parsed = CssColor.parse(color.trim());
  if (parsed._tag === "err") {
    return false;
  }
  const canvas = CssColor.toSrgb(parsed.value);
  return canvas.alpha === 1 && Wcag.relativeLuminance(canvas) >= NEAR_WHITE_LUMINANCE - LUMINANCE_ROUNDING;
}

export function stampBootstrapNonce(html: string, nonce: string): string {
  const scripts = bootstrapScripts(html);
  const bootstrap = scripts[0];
  if (bootstrap === undefined) {
    throw new Error("docs HTML is missing the host color-scheme bootstrap");
  }
  const tagEnd = html.indexOf(">", bootstrap.start);
  if (tagEnd === -1) {
    throw new Error("bootstrap script tag is not closed");
  }
  const openTag = html.slice(bootstrap.start, tagEnd);
  if (/\snonce\s*=/i.test(openTag)) {
    return html.replace(/\snonce="[^"]*"/i, ` nonce="${nonce}"`);
  }
  return `${html.slice(0, tagEnd)} nonce="${nonce}"${html.slice(tagEnd)}`;
}

export function stripContentEncoding(headers: Record<string, string>) {
  const next = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (lower === "content-encoding" || lower === "content-length") {
      continue;
    }
    next.set(name, value);
  }
  return Object.fromEntries(next);
}
