// The package scripts and the root release scripts both preload this loader so that
// `packages/fuse/scripts/**` can use extension-less imports. `registerHooks` runs the hook in
// this thread, so it must resolve synchronously.
import { registerHooks } from "node:module";

const tsExtensions = [".ts", ".tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("node:") || specifier.startsWith("data:")) {
      return nextResolve(specifier, context);
    }

    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      const hasKnownExtension = /\.[a-zA-Z0-9]+$/.test(specifier);
      if (!hasKnownExtension) {
        for (const extension of tsExtensions) {
          try {
            return nextResolve(`${specifier}${extension}`, context);
          } catch {
            // Try the next extension.
          }
        }
      }
    }

    return nextResolve(specifier, context);
  },
});
