import type { Rule } from "@oxlint/plugins";

import { unwrap } from "../ast-walk.ts";
import { constantString } from "../static-text.ts";

/**
 * A `"host" in root` test also passes for a document that exposes a `host` property through named
 * access, as it does for one `<form name="host">`. Fuse code tests for a shadow root through
 * `isShadowRoot` in `src/internal/dom-node.ts`, which reads the node type first. Its JSDoc lists
 * what breaks when a root walk takes such a document for a shadow root. The config scopes this rule
 * to `packages/fuse/src`.
 */
export const noHostInCheck: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: 'Forbid `"host" in` in Fuse source; test for a shadow root through `isShadowRoot`.',
    },
    messages: {
      hostIn:
        'Test for a shadow root with `isShadowRoot` from `src/internal/dom-node.ts`. `"host" in` is also true for a document that exposes a `host` property through named access.',
    },
    schema: [],
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === "in" && constantString(unwrap(node.left)) === "host") {
          context.report({ node, messageId: "hostIn" });
        }
      },
    };
  },
};
