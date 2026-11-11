import type { Rule } from "@oxlint/plugins";

import { anyViolates } from "../quantify.ts";
import { evaluate, targetOf } from "../resolve.ts";
import type { Alt } from "../resolve.ts";

/** A React hook's name: `use`, or `use` followed by a capital. */
const HOOK = /^use(?:[A-Z]|$)/u;

/**
 * Server-safe modules call no React hook: no `useState`, `use`, `React.useId` or custom `useX`,
 * whatever import or alias the hook arrives through. The config scopes this rule to the bespoke
 * icons and the illustrations, which render in a server component with no client state, so what a
 * hook would compute arrives as a prop. Importing React for `createElement`, or a hook's type, is
 * not a call and stays allowed.
 *
 * Scope: follows what `resolve.ts` follows, for the callee, any alternative of which may be the
 * hook. Beyond that: a hook handed in as an
 * argument and called through a parameter is not recognised.
 */
export const noHookCalls: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid React hook calls in server-safe modules." },
    messages: {
      hook: "`{{name}}` is a hook, and this module renders on the server with no client state. Take what the hook would compute as a prop.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const hookName = (callee: Alt): string | undefined => {
          const last = targetOf(callee)?.path.at(-1);
          return last !== undefined && HOOK.test(last) ? last : undefined;
        };
        const callees = evaluate(context, node.callee);
        if (!anyViolates(callees, (callee) => hookName(callee) !== undefined)) return;
        // The message names the first hook among the alternatives.
        const name = callees.map(hookName).find((last) => last !== undefined) ?? "";
        context.report({ node, messageId: "hook", data: { name } });
      },
    };
  },
};
