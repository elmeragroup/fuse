/**
 * A Tailwind-source consumer build of `fuse.css`, for the unit tests that check what such a
 * consumer's compiler emits. No shipped module imports it, so it lives with the test tooling.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import reactAriaComponents from "tailwindcss-react-aria-components";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stylesDir = join(packageRoot, "src/styles");
const nodeModules = join(packageRoot, "node_modules");

/** The style entry of each bare package `fuse.css` imports, from its `exports["."].style`. */
const PACKAGE_STYLES = new Map([["tw-animate-css", "tw-animate-css/dist/tw-animate.css"]]);

/** Resolve an `@import` the way a CSS bundler does, for the imports this build meets. */
function stylesheetPath(id: string, base: string): string {
  if (id.startsWith(".")) {
    return join(base, id);
  }
  const packageStyle = PACKAGE_STYLES.get(id);
  if (packageStyle !== undefined) {
    return join(nodeModules, packageStyle);
  }
  if (id.startsWith("tailwindcss/")) {
    return join(nodeModules, id);
  }
  throw new Error(`fuse.css imports no stylesheet named ${id}`);
}

/**
 * Compile `fuse.css` the way a Tailwind-source consumer does, with only the given candidates.
 *
 * @param candidates - The class names the consumer's sources spell.
 * @returns The unminified build.
 */
export async function consumerBuild(candidates: readonly string[]): Promise<string> {
  const compiler = await compile(
    '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css" source(none);\n@import "./fuse.css";',
    {
      base: stylesDir,
      loadStylesheet: (id, base) => {
        const path = stylesheetPath(id, base);
        return Promise.resolve({ path, base: dirname(path), content: readFileSync(path, "utf8") });
      },
      loadModule: (id, base) => {
        if (id !== "tailwindcss-react-aria-components") {
          throw new Error(`fuse.css loads no plugin but tailwindcss-react-aria-components, received ${id}`);
        }
        return Promise.resolve({ path: id, base, module: reactAriaComponents });
      },
    }
  );
  return compiler.build([...candidates]);
}
