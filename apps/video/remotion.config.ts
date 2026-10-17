import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";
import path from "node:path";

// The CLI reads this file; renders through the Node APIs pass the same options directly.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The brand heatmap is a WebGL shader. ANGLE gives headless Chrome a GPU-backed context.
Config.setChromiumOpenGlRenderer("angle");

// Remotion's webpack does not read tsconfig `paths`, so the `@` alias is wired here too.
Config.overrideWebpackConfig((current) => {
  const withTailwind = enableTailwind(current);
  const inherited = withTailwind.resolve?.alias ?? {};
  const aliases = Array.isArray(inherited)
    ? inherited
    : Object.entries(inherited).map(([name, alias]) => ({ name, alias }));
  return {
    ...withTailwind,
    // Studio names assets by their source path, and pnpm keeps the Roboto files in the repo root's
    // store, two levels above this app, so Studio served the faces from a URL it cannot answer and
    // the font gate failed. Hashed names, as renders use, keep every asset inside the bundle.
    output: { ...withTailwind.output, assetModuleFilename: "[hash][ext]" },
    resolve: {
      ...withTailwind.resolve,
      alias: [...aliases, { name: "@", alias: path.resolve("src") }],
    },
  };
});
