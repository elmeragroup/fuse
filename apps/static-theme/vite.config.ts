import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import type { ColorScheme, ColorSchemeOptions } from "@elmeragroup/ui/theme";

import { colorSchemeScriptSource, themeAttributes } from "../../packages/ui/dist/theme.js";
import { DOCUMENT_COLOR_SCHEME, DOCUMENT_THEME } from "./src/theme.ts";

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ENTRY_SCRIPT = /<script\b[^>]*\btype=(["'])module\1[^>]*>/i;
const HTML_OPEN_TAG = /<html\b[^>]*>/i;

function isForcedDarkDocument(filename: string, urlPath: string): boolean {
  return filename.includes("forced-dark") || urlPath.includes("forced-dark");
}

function colorSchemeOptionsForDocument(filename: string, urlPath: string): ColorSchemeOptions {
  const forcedColorScheme: ColorScheme | undefined = isForcedDarkDocument(filename, urlPath)
    ? "dark"
    : undefined;
  return {
    storageKey: DOCUMENT_COLOR_SCHEME.storageKey,
    defaultColorScheme: DOCUMENT_COLOR_SCHEME.defaultColorScheme,
    enableSystem: DOCUMENT_COLOR_SCHEME.enableSystem,
    forcedColorScheme,
  };
}

function applyHostBrandAttributes(html: string): string {
  const attributes = themeAttributes(DOCUMENT_THEME);
  const open = HTML_OPEN_TAG.exec(html);
  if (open === null) {
    throw new Error("Vite HTML is missing the <html> tag");
  }
  const next = open[0]
    .replace(/\sdata-theme-variant="[^"]*"/gi, "")
    .replace(/\sdata-theme-brand="[^"]*"/gi, "")
    .replace(/\sdata-theme-segment="[^"]*"/gi, "")
    .replace(
      />$/,
      ` data-theme-variant="${attributes["data-theme-variant"]}" data-theme-brand="${attributes["data-theme-brand"]}" data-theme-segment="${attributes["data-theme-segment"]}">`
    );
  return `${html.slice(0, open.index)}${next}${html.slice(open.index + open[0].length)}`;
}

function hoistStylesheetsBefore(html: string, beforeIndex: number): string {
  const pattern = /<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>\s*/gi;
  const late: string[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  let match = pattern.exec(html);
  while (match) {
    if (match.index >= beforeIndex) {
      late.push(match[0].trim());
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
    match = pattern.exec(html);
  }
  if (late.length === 0) {
    return html;
  }

  let next = html;
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index];
    if (range === undefined) {
      continue;
    }
    next = `${next.slice(0, range.start)}${next.slice(range.end)}`;
  }

  return `${next.slice(0, beforeIndex)}${late.join("")}${next.slice(beforeIndex)}`;
}

function injectClassicBootstrap(html: string, source: string): string {
  if (!/<link\b[^>]*\brel=(["'])stylesheet\1/i.test(html)) {
    throw new Error("Vite HTML is missing the token stylesheet");
  }
  const match = MODULE_ENTRY_SCRIPT.exec(html);
  if (match === null) {
    throw new Error("Vite HTML is missing the module entry script");
  }
  // Token CSS must precede the parser-blocking IIFE so --background is defined
  // before first paint; the IIFE itself must still precede the module entry.
  const withBootstrap = `${html.slice(0, match.index)}<script>${source}</script>${html.slice(match.index)}`;
  return hoistStylesheetsBefore(withBootstrap, match.index);
}

function injectHostFirstPaint(html: string, filename: string, urlPath: string): string {
  const branded = applyHostBrandAttributes(html);
  const source = colorSchemeScriptSource(colorSchemeOptionsForDocument(filename, urlPath));
  if (source === "") {
    throw new Error("colorSchemeScriptSource returned an empty bootstrap");
  }
  return injectClassicBootstrap(branded, source);
}

function elmeraColorSchemeHtml(): Plugin {
  return {
    name: "elmera-color-scheme-html",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        return injectHostFirstPaint(html, ctx.filename, ctx.path);
      },
    },
  };
}

export default defineConfig({
  plugins: [elmeraColorSchemeHtml()],
  build: {
    rollupOptions: {
      input: {
        main: path.join(fixtureRoot, "index.html"),
        forcedDark: path.join(fixtureRoot, "forced-dark.html"),
      },
    },
  },
});
