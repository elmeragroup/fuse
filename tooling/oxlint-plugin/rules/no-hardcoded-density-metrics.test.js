import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import noHardcodedDensityMetrics from "./no-hardcoded-density-metrics.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "hardcodedMetric" };

const buttonVariantsSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../packages/ui/src/components/button/button-variants.ts"
  ),
  "utf8"
);

/**
 * @param {string} sizeObject
 */
function recipe(sizeObject) {
  return `import { tv } from "tailwind-variants";
export const recipe = tv({
  base: "inline-flex rounded-md border border-transparent active:translate-y-px",
  variants: {
    variant: { default: "bg-primary" },
    size: ${sizeObject},
  },
  defaultVariants: { variant: "default", size: "default" },
});
`;
}

tester.run("elmera/no-hardcoded-density-metrics", noHardcodedDensityMetrics, {
  valid: [
    {
      name: "size axis reads control height variable",
      code: recipe('{ default: "h-(--control-h-md)" }'),
    },
    {
      name: "icon-inline hit-area and line-height sizing stay legal",
      code: recipe('{ "icon-inline": "hit-area-1 aspect-square h-lh w-auto" }'),
    },
    {
      name: "radius clamps stay legal",
      code: recipe('{ xs: "h-(--control-h-xs) rounded-[min(var(--radius-md),8px)]" }'),
    },
    {
      name: "icon glyph size on svg children stays legal",
      code: recipe("{ xs: \"h-(--control-h-xs) [&_svg:not([class*='size-'])]:size-3\" }"),
    },
    {
      name: "size-owned sm type stays legal",
      code: recipe('{ sm: "text-sm h-(--control-h-sm) px-(--control-px-sm)" }'),
    },
    {
      name: "size-owned xs type stays legal",
      code: recipe('{ xs: "text-xs h-(--control-h-xs)" }'),
    },
    {
      name: "token-read md/lg type stays legal",
      code: recipe(
        '{ default: "h-(--control-h-md) [font-size:var(--control-text)] [line-height:var(--control-leading)]" }'
      ),
    },
    {
      name: "numeric spacing on the color variant axis is not a size-axis metric",
      code: `import { tv } from "tailwind-variants";
export const recipe = tv({
  base: "h-9 px-2.5 gap-1.5 text-sm",
  variants: {
    variant: { default: "h-9 px-2.5" },
    size: { default: "h-(--control-h-md)" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
`,
    },
    {
      name: "layout gap and translation outside tv are not matched",
      code: `const layout = "gap-4 p-6 translate-y-px";
`,
    },
    {
      name: "vertical padding in the size axis is not density-owned",
      code: recipe('{ default: "h-(--control-h-md) py-2" }'),
    },
    {
      name: "square icon rung reads control height via size-*",
      code: recipe('{ icon: "size-(--control-h-md)" }'),
    },
    {
      name: "type-scale size axis is not a density rung",
      code: recipe(
        '{ xs: "text-xs *:text-xs", sm: "text-sm", default: "text-base *:text-base **:text-base", lg: "text-lg leading-snug" }'
      ),
    },
    {
      name: "overlay max-width size axis with layout padding is not a density rung",
      code: recipe('{ sm: "max-w-sm p-6", md: "max-w-[min(var(--container-md),90%)]" }'),
    },
    {
      name: "Button recipe after density retokenization has no false positives",
      filename: "packages/ui/src/components/button/button-variants.ts",
      code: buttonVariantsSource,
    },
  ],
  invalid: [
    {
      name: "warns on hardcoded control height in the size axis",
      code: recipe('{ default: "h-9" }'),
      errors: [error],
    },
    {
      name: "warns on hardcoded inline padding",
      code: recipe('{ default: "px-2.5" }'),
      errors: [error],
    },
    {
      name: "warns on hardcoded icon-edge padding",
      code: recipe('{ default: "has-data-[icon=inline-start]:pl-2" }'),
      errors: [error],
    },
    {
      name: "warns on hardcoded control gap",
      code: recipe('{ default: "gap-1.5" }'),
      errors: [error],
    },
    {
      name: "warns on hardcoded md control type",
      code: recipe('{ default: "h-(--control-h-md) text-sm" }'),
      errors: [error],
    },
    {
      name: "warns on hardcoded lg control type",
      code: recipe('{ lg: "h-(--control-h-lg) text-base leading-6" }'),
      errors: [error, error],
    },
    {
      name: "warns on hardcoded square control size",
      code: recipe('{ icon: "size-9" }'),
      errors: [error],
    },
    {
      name: "warns on hardcoded height on icon-inline",
      code: recipe('{ "icon-inline": "h-9 hit-area-1" }'),
      errors: [error],
    },
  ],
});
