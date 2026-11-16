import type { ESTree, Rule } from "@oxlint/plugins";

import { staticText } from "../static-text.ts";

/** Tailwind's internal ring variable, spelled inside a string. */
const RING_SHADOW = "--tw-ring-shadow";

/**
 * A component test checks its focus ring through `packages/fuse/test/assert-focus-ring.ts`, which
 * reads the painted `box-shadow` against the `--ring` role. A test that reads `--tw-ring-shadow`
 * pins Tailwind's internal variable rather than what the user sees, and drifts when the ring
 * recipe or Tailwind changes. The config scopes this rule to component tests.
 */
export const noRingShadowRead: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid `--tw-ring-shadow` in component tests; check focus rings through assert-focus-ring.",
    },
    messages: {
      ringShadow:
        "Check the focus ring through `test/assert-focus-ring.ts` (`expectFocusRing`, `assertFocusRingOnKeyboardAbsentOnMouse`), which reads the painted ring, not Tailwind's `--tw-ring-shadow`.",
    },
    schema: [],
  },
  create(context) {
    const check = (node: ESTree.Node): void => {
      if (staticText(node)?.includes(RING_SHADOW) === true) context.report({ node, messageId: "ringShadow" });
    };
    return { Literal: check, TemplateElement: check };
  },
};
