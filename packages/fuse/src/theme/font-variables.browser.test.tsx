/**
 * The font-variable cases (`test/font-variable-cases.tsx`) in a Tailwind-source consumer build,
 * laid out as `@import "tailwindcss"` lays it out: Tailwind's theme in the `theme` layer, its
 * utilities in the `utilities` layer, then `fuse.css`, with `themes.css` unlayered.
 */
import { beforeAll } from "vitest";

import "../../dist/themes.css";
import { describeFontVariables } from "../../test/font-variable-cases";
import { consumerCss } from "../../test/tailwind-consumer-build";
import { headingVariants } from "../components/heading/heading-variants";
import { textVariants } from "../components/text/text-variants";

const CONSUMER = [
  "@layer theme, base, components, utilities;",
  '@import "tailwindcss/theme.css" layer(theme);',
  '@import "tailwindcss/utilities.css" layer(utilities) source(none);',
  '@import "./fuse.css";',
].join("\n");

beforeAll(async () => {
  const style = document.createElement("style");
  const candidates = [...headingVariants().split(" "), ...textVariants().split(" ")];
  style.textContent = await consumerCss(CONSUMER, candidates);
  document.head.append(style);
});

describeFontVariables();
