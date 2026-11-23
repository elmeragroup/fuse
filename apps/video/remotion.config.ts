import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

// The brand heatmap is a WebGL shader. ANGLE gives headless Chrome a GPU-backed context.
Config.setChromiumOpenGlRenderer("angle");

Config.overrideWebpackConfig((current) => {
  const withTailwind = enableTailwind(current);
  return {
    ...withTailwind,
    // Studio names assets by their source path, and pnpm keeps the Roboto files in the repo root's
    // store, two levels above this app, so Studio served the faces from a URL it cannot answer and
    // the font gate failed. Hashed names, as renders use, keep every asset inside the bundle.
    output: { ...withTailwind.output, assetModuleFilename: "[hash][ext]" },
  };
});
