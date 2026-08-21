import type { Plugin } from "postcss";

import elmeraDemoStageDensity from "./scripts/elmera-demo-stage-density";

// Array-form entries of [plugin specifier-or-factory, options] — the shape Next.js/
// Turbopack's PostCSS transform accepts. Object form would resolve keys via require()
// and ignore function values.
//
// A TypeScript config (and TS plugin imports) works because Turbopack compiles
// the config graph itself — proven against Next 16.3.x, not documented. If a
// future Next silently drops .ts configs, first-paint.browser.test.ts fails on
// unresolved --control-* density metrics.
export type PostCssConfig = {
  plugins: Array<[string | (() => Plugin), object]>;
};

const config: PostCssConfig = {
  plugins: [
    ["@tailwindcss/postcss", {}],
    [elmeraDemoStageDensity, {}],
  ],
};

export default config;
