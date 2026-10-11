/**
 * A Tailwind-source consumer build of `fuse.css` for browser tests, which inject the result and
 * read the cascade. The entry names its own `@import`s and layers, so a test can write the
 * layered form a preflight-free host uses.
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

/**
 * Compile a consumer entry that imports `./fuse.css` and Tailwind's sheets.
 *
 * @param entry - The consumer's CSS entry.
 * @param candidates - The class names the consumer's sources spell.
 * @returns The unminified build.
 */
export async function layeredConsumerCss(entry: string, candidates: readonly string[]): Promise<string> {
  const compiler = await compile(entry, {
    base: "/",
    loadStylesheet: (id, base) => {
      const content = STYLESHEETS.get(id);
      if (content === undefined) {
        throw new Error(`the layered consumer imports no stylesheet named ${id}`);
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
