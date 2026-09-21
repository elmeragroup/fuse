import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import type { ColorScheme, ColorSchemeOptions } from "@elmeragroup/fuse/theme";

import {
  colorSchemeScriptSource,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "../../packages/fuse/dist/theme.js";
import { applyHostRootAttributes } from "./src/host-html.ts";
import { DOCUMENT_COLOR_SCHEME, DOCUMENT_THEME } from "./src/theme.ts";

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ENTRY_SCRIPT = /<script\b[^>]*\btype=(["'])module\1[^>]*>/i;

function isForcedDarkDocument(filename: string, urlPath: string): boolean {
  return filename.includes("forced-dark") || urlPath.includes("forced-dark");
}

function isComfortableDocument(filename: string, urlPath: string): boolean {
  return filename.includes("comfortable") || urlPath.includes("comfortable");
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

function stampHostRootAttributes(html: string, filename: string, urlPath: string): string {
  const attributes = themeAttributes(DOCUMENT_THEME);
  const density = densityAttributes(
    isComfortableDocument(filename, urlPath)
      ? "comfortable"
      : defaultDensityForVariant(DOCUMENT_THEME.variant)
  );
  return applyHostRootAttributes(html, attributes, density);
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
  const branded = stampHostRootAttributes(html, filename, urlPath);
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
        comfortable: path.join(fixtureRoot, "comfortable.html"),
      },
    },
  },
});
