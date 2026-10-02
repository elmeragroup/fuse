import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { BOOTSTRAP_MANIFEST_KEY, INJECTED_BOOTSTRAP_SOURCE_KEY, inlineScripts } from "../../docs/test/html";

// The tag readers, document constants and canvas classifier are the docs suite's; only the
// manifest types and the host-bootstrap predicate differ per app.
export {
  DOCUMENT_BRAND,
  EXPECTED_BOOTSTRAP_MANIFEST,
  INJECTED_BOOTSTRAP_SOURCE_KEY,
  canvasScheme,
  readDocumentBrand,
  readDocumentDensity,
} from "../../docs/test/html";

export const EXPECTED_FORCED_DARK_MANIFEST = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
  forcedColorScheme: "dark",
} as const;

export type ColorSchemeBootstrapManifest = {
  storageKey: string;
  defaultColorScheme: string;
  enableSystem: boolean;
  forcedColorScheme: string | undefined;
};

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
