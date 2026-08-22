import { defineRule } from "@oxlint/plugins";

import { extractStrings, isNamedCall } from "../extract-strings.js";
import { normalizeFilename } from "../filename-normalizer.js";

const ALLOWED_UTILS_SUFFIX = "/src/styles/utils.ts";

// Focus-state ring utilities. Invalid-state rings (aria-invalid:ring) and static
// popup hairlines (ring-1 ring-border) do not include a focus prefix and are not matched.
const FOCUS_RING_RE =
  /(?:^|[\s"'`[])(?:[\w-[\]]+:)*(?:focus(?:-visible|-within)?|has-focus|in-focus|data-\[focus(?:-visible)?\]):(?:[\w-[\]]+:)*ring(?:-|\b)/;

/**
 * @param {string} filename
 */
function isFocusRingUtils(filename) {
  return normalizeFilename(filename).endsWith(ALLOWED_UTILS_SUFFIX);
}

/**
 * @param {import("estree").Node | null | undefined} node
 */
function isFocusVisibleIdentifier(node) {
  return node?.type === "Identifier" && node.name === "isFocusVisible";
}

/**
 * @param {string} str
 */
function hasBareRingClass(str) {
  return /(?:^|[\s"'`])(?:[\w-]+:)*ring(?:-\S+)?/.test(str);
}

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Forbid focus-state ring classes outside packages/ui/src/styles/utils.ts",
    },
    messages: {
      localFocusRing:
        "Focus-state rings must come from the package-private focusRing recipe in src/styles/utils.ts.",
    },
    schema: [],
  },
  defaultOptions: [],
  createOnce(context) {
    /**
     * @param {import("estree").Node} node
     * @param {string[]} collected
     */
    function reportFocusRingStrings(node, collected) {
      for (const value of collected) {
        if (FOCUS_RING_RE.test(value)) {
          context.report({ node, messageId: "localFocusRing" });
          return;
        }
      }
    }

    /**
     * @param {import("estree").Node} node
     */
    function reportRacFocusVisibleRing(node) {
      const strings = extractStrings(node);
      if (strings.some(hasBareRingClass)) {
        context.report({ node, messageId: "localFocusRing" });
      }
    }

    let skipFile = false;

    return {
      Program() {
        skipFile = isFocusRingUtils(context.filename);
      },
      JSXAttribute(node) {
        if (skipFile) return;
        const name = node.name.type === "JSXIdentifier" ? node.name.name : undefined;
        if (name !== "className" && name !== "class") return;
        if (node.value) {
          reportFocusRingStrings(node, extractStrings(node.value));
        }
      },
      CallExpression(node) {
        if (skipFile) return;
        if (!isNamedCall(node.callee, "tv") && !isNamedCall(node.callee, "cn")) return;
        reportFocusRingStrings(node, extractStrings(node));
      },
      Literal(node) {
        if (skipFile) return;
        if (typeof node.value === "string") {
          reportFocusRingStrings(node, [node.value]);
        }
      },
      TemplateLiteral(node) {
        if (skipFile) return;
        reportFocusRingStrings(node, extractStrings(node));
      },
      ConditionalExpression(node) {
        if (skipFile) return;
        if (isFocusVisibleIdentifier(node.test)) {
          reportRacFocusVisibleRing(node);
        }
      },
      LogicalExpression(node) {
        if (skipFile) return;
        if (isFocusVisibleIdentifier(node.left) || isFocusVisibleIdentifier(node.right)) {
          reportRacFocusVisibleRing(node);
        }
      },
    };
  },
});
