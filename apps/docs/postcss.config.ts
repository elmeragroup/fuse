import elmeraDemoStageDensity from "./scripts/elmera-demo-stage-density";

// Minimal shape accepted by Next.js/Turbopack's PostCSS transform: array-form
// entries of [plugin specifier-or-factory, options]. Object form would resolve
// keys via require() and ignore function values.
//
// A TypeScript config (and TS plugin imports) works because Turbopack compiles
// the config graph itself — proven against Next 16.3.x, not documented. If a
// future Next silently drops .ts configs, first-paint.browser.test.ts fails on
// unresolved --control-* density metrics.
export type PostCssPluginFactory = () => { postcssPlugin: string };

export type PostCssConfig = {
  plugins: Array<[string | PostCssPluginFactory, object]>;
};

const config: PostCssConfig = {
  plugins: [
    ["@tailwindcss/postcss", {}],
    [elmeraDemoStageDensity, {}],
  ],
};

export default config;
