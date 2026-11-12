import type { ESTree, Rule } from "@oxlint/plugins";

import { classesOf, parseClass } from "../class-token.ts";
import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/**
 * An entry or exit state: Base UI's `data-starting-style` and `data-ending-style`, in either
 * spelling, and Tailwind's `starting:` for `@starting-style`.
 */
const TRANSITION_STATE =
  /^(?:starting|data-starting-style|data-ending-style|data-\[(?:starting|ending)-style\])$/u;

/** A translate, scale or rotate utility, negative or important, on any axis or arbitrary value. */
const TRANSFORM = /^!?-?(?:translate|scale|rotate)-/u;

/**
 * A translate, scale or rotate on an entry or exit state is declared under `motion-safe:`. The
 * central reduced-motion rule in `styles/fuse.css` drops `translate`, `scale` and `rotate` from
 * every transition but cannot zero them, since static centring uses `translate` (dialog, command). So
 * under reduced motion a transformed starting state jumps to rest instead of easing, and a
 * transformed ending state jumps away while its fade runs. Under `motion-safe:` the offset
 * applies only where it animates, and a reduced-motion user sees the fade alone, as ActionBar
 * does. A state's own variants may sit anywhere in the chain, so
 * `data-starting-style:motion-safe:translate-y-1` passes too.
 */
export const motionSafeTransform: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `motion-safe:` on translate, scale and rotate utilities on entry and exit states.",
    },
    messages: {
      unsafe:
        "`{{token}}` moves an entry or exit state that reduced motion cannot ease, so it jumps. Declare it under `motion-safe:`.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const check = (node: ESTree.Node): void => {
      const text = staticText(node);
      if (text === undefined) return;
      for (const token of classesOf(text)) {
        const { variants, utility } = parseClass(token);
        if (
          TRANSFORM.test(utility) &&
          variants.some((variant) => TRANSITION_STATE.test(variant)) &&
          !variants.includes("motion-safe")
        ) {
          context.report({ node, messageId: "unsafe", data: { token } });
        }
      }
    };
    return { Literal: check, TemplateElement: check };
  },
};
