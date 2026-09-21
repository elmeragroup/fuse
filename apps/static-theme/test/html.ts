import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DOCUMENT_COLOR_SCHEME, DOCUMENT_THEME } from "../src/theme";

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const packedThemeHref = pathToFileURL(path.join(fixtureRoot, "../../packages/fuse/dist/theme.js")).href;

export const BOOTSTRAP_MANIFEST_KEY = "__ELMERA_COLOR_SCHEME_BOOTSTRAP__";
export const INJECTED_BOOTSTRAP_SOURCE_KEY = "elmera.colorScheme.bootstrapSource";

export const DOCUMENT_BRAND = {
  variant: DOCUMENT_THEME.variant,
  brand: DOCUMENT_THEME.brand,
  segment: DOCUMENT_THEME.segment,
} as const;

export const EXPECTED_BOOTSTRAP_MANIFEST = {
  storageKey: DOCUMENT_COLOR_SCHEME.storageKey,
  defaultColorScheme: DOCUMENT_COLOR_SCHEME.defaultColorScheme,
  enableSystem: DOCUMENT_COLOR_SCHEME.enableSystem,
  forcedColorScheme: undefined,
} as const;

export const EXPECTED_FORCED_DARK_MANIFEST = {
  storageKey: DOCUMENT_COLOR_SCHEME.storageKey,
  defaultColorScheme: DOCUMENT_COLOR_SCHEME.defaultColorScheme,
  enableSystem: DOCUMENT_COLOR_SCHEME.enableSystem,
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

export function packedColorSchemeScriptSource(optionsLiteral: string): string {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { colorSchemeScriptSource } from ${JSON.stringify(packedThemeHref)};
process.stdout.write(colorSchemeScriptSource(${optionsLiteral}));`,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "packed colorSchemeScriptSource failed");
  }
  return result.stdout;
}

export function isLightCanvas(color: string): boolean {
  const value = color.trim().toLowerCase();
  if (value === "white") {
    return true;
  }
  if (/^rgba?\(\s*255\s*,\s*255\s*,\s*255(?:\s*,\s*1(?:\.0+)?)?\s*\)$/.test(value)) {
    return true;
  }
  if (/^oklch\(\s*1(?:\.0+)?\b/.test(value)) {
    return true;
  }
  const lab = /^lab\(\s*([0-9.]+)%?\s/.exec(value);
  if (lab?.[1] === undefined) {
    return false;
  }
  return Number(lab[1]) >= 99;
}
