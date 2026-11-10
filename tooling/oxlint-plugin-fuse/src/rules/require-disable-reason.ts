import type { Rule } from "@oxlint/plugins";

/** A disable directive at the start of a comment, in both spellings oxlint honours. */
const DIRECTIVE = /^\s*(?:oxlint|eslint)-disable(?:-next-line|-line)?(?=\s|$)/u;

/** The separator between a directive's rules and its reason. */
const SEPARATOR = " -- ";

/** Non-space characters a reason must carry, so it says more than "needed". */
const MINIMUM_REASON = 8;

/**
 * Every `oxlint-disable` or `eslint-disable` comment carries ` -- ` and a reason of at least eight
 * non-space characters. A silenced rule is a decision a reader must be able to check, and the
 * reason sits beside the code it excuses.
 */
export const requireDisableReason: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require a reason after ` -- ` on every lint disable comment." },
    messages: {
      missing:
        "Give this disable comment a reason: `{{directive}} -- <why the rule does not apply here>`, at least 8 non-space characters.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === "Shebang") continue;
          const directive = DIRECTIVE.exec(comment.value);
          if (directive === null) continue;
          const rest = comment.value.slice(directive[0].length);
          const separator = rest.indexOf(SEPARATOR);
          const reason = separator === -1 ? "" : rest.slice(separator + SEPARATOR.length);
          if (reason.replace(/[\s*]/gu, "").length >= MINIMUM_REASON) continue;
          context.report({
            node: comment,
            messageId: "missing",
            data: { directive: directive[0].trim() },
          });
        }
      },
    };
  },
};
