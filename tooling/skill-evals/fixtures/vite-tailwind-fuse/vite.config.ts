import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import { colorSchemeScriptSource, documentAttributes } from "@elmeragroup/fuse/theme";

import { COLOR_SCHEME, DENSITY, THEME } from "./src/theme.ts";

const HTML_START_TAG = /<html\b[^>]*>/i;
const MODULE_SCRIPT = /<script\b[^>]*\btype=(["'])module\1[^>]*>/i;
const STYLESHEET_LINK = /<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>\s*/gi;

/**
 * Stamps the theme and density on `<html>` and puts the color scheme bootstrap before the module
 * entry, with the built stylesheets ahead of it, as /handbook/theming#vite describes.
 */
function fuseFirstPaint(): Plugin {
  return {
    name: "fuse-first-paint",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const attributes = Object.entries(documentAttributes({ theme: THEME, density: DENSITY }))
          .map(([name, value]) => ` ${name}="${value}"`)
          .join("");
        const stamped = html.replace(HTML_START_TAG, (tag) => tag.replace(/>$/, `${attributes}>`));
        const entry = MODULE_SCRIPT.exec(stamped);
        if (entry === null) throw new Error("index.html has no module entry script");
        const before = stamped.slice(0, entry.index);
        const after = stamped.slice(entry.index);
        const links = after.match(STYLESHEET_LINK) ?? [];
        const rest = after.replace(STYLESHEET_LINK, "");
        const bootstrap = `<script>${colorSchemeScriptSource(COLOR_SCHEME)}</script>`;
        return `${before}${links.map((link) => link.trim()).join("")}${bootstrap}${rest}`;
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), fuseFirstPaint()],
});
