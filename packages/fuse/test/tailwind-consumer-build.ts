/**
 * A Tailwind-source consumer build of `fuse.css`. Unit tests read what a standalone consumer's
 * compiler emits; browser tests pass their own entry, such as the layered form a preflight-free
 * host uses, inject the result and read the cascade. No shipped module imports it, so it lives
 * with the test tooling.
 */
import { compile } from "tailwindcss";
import reactAriaComponents from "tailwindcss-react-aria-components";
import themeCss from "tailwindcss/theme.css?raw";
import utilitiesCss from "tailwindcss/utilities.css?raw";

import twAnimateCss from "../node_modules/tw-animate-css/dist/tw-animate.css?raw";
import fuseCss from "../src/styles/fuse.css?raw";

/** The stylesheets a Tailwind-source consumer's `@import`s reach, keyed by the specifier. */
const STYLESHEETS = new Map([
  ["tailwindcss/theme.css", themeCss],
  ["tailwindcss/utilities.css", utilitiesCss],
  ["./fuse.css", fuseCss],
  ["tw-animate-css", twAnimateCss],
]);

/** The entry of a standalone consumer that imports Tailwind's sheets and `fuse.css`. */
const STANDALONE_ENTRY =
  '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css" source(none);\n@import "./fuse.css";';

/**
 * Compile a consumer entry that imports `./fuse.css` and Tailwind's sheets.
 *
 * @param entry - The consumer's CSS entry.
 * @param candidates - The class names the consumer's sources spell.
 * @returns The unminified build.
 */
export async function consumerCss(entry: string, candidates: readonly string[]): Promise<string> {
  const compiler = await compile(entry, {
    base: "/",
    loadStylesheet: (id, base) => {
      const content = STYLESHEETS.get(id);
      if (content === undefined) {
        throw new Error(`the consumer entry imports no stylesheet named ${id}`);
      }
      return Promise.resolve({ path: id, base, content });
    },
    loadModule: (id, base) => {
      if (id !== "tailwindcss-react-aria-components") {
        throw new Error(`fuse.css loads no plugin but tailwindcss-react-aria-components, received ${id}`);
      }
      return Promise.resolve({ path: id, base, module: reactAriaComponents });
    },
  });
  return compiler.build([...candidates]);
}

/**
 * Compile `fuse.css` the way a Tailwind-source consumer does, with only the given candidates.
 *
 * @param candidates - The class names the consumer's sources spell.
 * @returns The unminified build.
 */
export async function consumerBuild(candidates: readonly string[]): Promise<string> {
  return consumerCss(STANDALONE_ENTRY, candidates);
}
