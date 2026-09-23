import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import reactAriaComponents from "tailwindcss-react-aria-components";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const nodeModules = join(here, "../../node_modules");
const compiledCssPath = join(here, "../../dist/styles.css");

/**
 * Corner utilities a `--radius-*` entry in `@theme` would add to a consumer's build. The
 * corners outside the `rounded-*` scale live in `corner-radius.ts` as private classes, so
 * none of these names may resolve.
 */
const PRIVATE_CORNER_CANDIDATES = [
  "rounded-inset",
  "rounded-fixed",
  "rounded-t-inset",
  "rounded-t-fixed",
] as const;
const PRIVATE_CORNER_SELECTOR = /\.rounded-(?:t-)?(?:inset|fixed)\b/;
const PRIVATE_CORNER_VARIABLE = /--radius-(?:inset|fixed)\b/;

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

/** Compile `fuse.css` the way a Tailwind-source consumer does, with only the given candidates. */
async function consumerBuild(candidates: readonly string[]): Promise<string> {
  const compiler = await compile(
    '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css" source(none);\n@import "./fuse.css";',
    {
      base: here,
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

describe("private corner classes", () => {
  it("add no rounded-* utility to a Tailwind-source consumer's build", async () => {
    const css = await consumerBuild([...PRIVATE_CORNER_CANDIDATES, "rounded-md", "rounded-button"]);
    // The scale rung and the button utility resolve, so the build itself is populated.
    expect(css).toContain(".rounded-md {");
    expect(css).toContain(".rounded-button {");
    expect(css).not.toMatch(PRIVATE_CORNER_SELECTOR);
    expect(css).not.toMatch(PRIVATE_CORNER_VARIABLE);
  });

  it("leave no corner utility or theme variable in the standalone stylesheet", () => {
    expect(existsSync(compiledCssPath), compiledCssPath).toBe(true);
    const css = readFileSync(compiledCssPath, "utf8");
    expect(css).not.toMatch(PRIVATE_CORNER_SELECTOR);
    expect(css).not.toMatch(PRIVATE_CORNER_VARIABLE);
  });
});
