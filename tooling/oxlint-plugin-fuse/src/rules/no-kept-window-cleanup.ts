import type { ESTree, Rule } from "@oxlint/plugins";

import { isFunction, unwrap } from "../ast-walk.ts";
import { firstViolation } from "../quantify.ts";
import type { Alt } from "../resolve.ts";
import { evaluate, memberName } from "../resolve.ts";
import { relativeImportPath } from "../source-file.ts";

/**
 * The cleanup calls that act on work a window holds for the document it showed then, each with the
 * message it gets.
 */
const CLEANUP_MESSAGES: ReadonlyMap<string, "keptWindow" | "keptTimer" | "keptListener"> = new Map([
  ["cancelAnimationFrame", "keptWindow"],
  ["clearTimeout", "keptTimer"],
  ["clearInterval", "keptTimer"],
  ["removeEventListener", "keptListener"],
]);

/** The module of Fuse's `windowOf` and `windowShowing`, as a path resolved from the linted file. */
const DOM_NODE = /\/packages\/fuse\/src\/internal\/dom-node(?:\.[jt]s)?$/;

/**
 * A node's window, kept from setup, may show another document by the time cleanup runs. A cancel
 * or clear through it then hits that document's frame or timer with the same id, and these cleanup
 * calls on it throw once the document is cross-origin. Fuse cancels a frame through `windowShowing(document)`
 * from `src/internal/dom-node.ts`, called at cleanup time. This rule flags a cleanup call on any value
 * the shared resolver reads as `.defaultView`, as a call to that module's `windowOf`, or as a call
 * to its `windowShowing` made in a function around the cleanup's own. It flags a
 * `removeEventListener` on any of these, a `windowShowing(...)` called in the cleanup included. A
 * window that took a new same-origin document still holds its listeners, and `windowShowing`
 * returns null for it, so only an `AbortSignal` removes them. That window also keeps running its
 * timers, so a timer clear gets its own message: run the timer on the host's window, or set a
 * one-shot timeout whose callback does nothing once the cleanup has cleared the variable that holds
 * it. A `clearInterval` through any `windowShowing(...)` is flagged too, since the interval keeps
 * running there; a guarded `clearTimeout` of such a one-shot timeout is allowed. The rule matches `windowOf` and `windowShowing` imported from Fuse's
 * `packages/fuse/src/internal/dom-node.ts`, resolving a relative specifier from the linted file. The
 * config scopes the rule to `packages/fuse/src`.
 *
 * The rule reads where a `windowShowing` call sits, not when it runs. It flags a cleanup in a
 * callback that runs at once, such as one passed to a helper that calls it before returning, so a
 * cleanup there calls `windowShowing` again. It misses a result cached from a local
 * function that wraps `windowShowing`, since that call sits in a function beside the cleanup.
 */
export const noKeptWindowCleanup: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid canceling, clearing or removing a listener through a node's window kept from setup; use `windowShowing` at cleanup time, a timer the cleanup invalidates, or an `AbortSignal`.",
    },
    messages: {
      keptWindow:
        "Call `{{name}}` through `windowShowing(document)` from `src/internal/dom-node.ts`, called in the cleanup. A node's window may show another document by cleanup time, where this call hits that document's frame or throws across origins.",
      keptTimer:
        "Set this timer on the host's `window`, or set a one-shot timeout whose callback returns early once the cleanup has cleared the variable that holds it, as `src/components/skeleton/skeleton-font-watch.ts` does. A node's window may show another document by cleanup time, where `{{name}}` hits that document's timer or throws across origins. A reused initial about:blank window keeps running the timer, and `windowShowing` returns null for it, so a guarded `{{name}}` leaks it.",
      keptListener:
        "Pass an `AbortController`'s `signal` when you add this listener, and call `abort()` in the cleanup. A window that shows another document by cleanup time still holds the listener, and `windowShowing` returns null for it, so a guarded remove leaks it.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (callee.type !== "MemberExpression") return;
        const name = memberName(callee);
        const messageId = name === undefined ? undefined : CLEANUP_MESSAGES.get(name);
        if (messageId === undefined) return;
        const alwaysLeaks = messageId === "keptListener" || name === "clearInterval";
        const kept = firstViolation(evaluate(context, callee.object), (receiver) =>
          keptWindow(receiver, node, alwaysLeaks, context.filename) ? messageId : undefined
        );
        if (kept !== undefined) context.report({ node, messageId: kept, data: { name } });
      },
    };
  },
};

/**
 * Whether a cleanup call goes through a window read before cleanup time: `.defaultView`,
 * `windowOf(...)`, or `windowShowing(...)` called in a function around the cleanup's. A listener
 * removal or an interval clear through any `windowShowing(...)` counts too.
 */
function keptWindow(receiver: Alt, cleanup: ESTree.Node, alwaysLeaks: boolean, filename: string): boolean {
  if (receiver.kind === "member") return receiver.key === "defaultView";
  if (receiver.kind !== "call" || !fromDomNode(receiver.callee.source, filename)) return false;
  const { imported } = receiver.callee;
  return (
    imported === "windowOf" ||
    (imported === "windowShowing" && (alwaysLeaks || readOutside(receiver.node, cleanup)))
  );
}

/** Whether a specifier, relative to `filename`, names Fuse's `src/internal/dom-node.ts`. */
function fromDomNode(specifier: string, filename: string): boolean {
  const path = relativeImportPath(filename, specifier);
  return path !== undefined && DOM_NODE.test(path);
}

/** Whether `read` sits in a function around the one `cleanup` sits in, so it ran before it. */
function readOutside(read: ESTree.Node, cleanup: ESTree.Node): boolean {
  const home = enclosingFunction(read);
  let crossed = false;
  for (let node: ESTree.Node | null = cleanup.parent; node !== null; node = node.parent) {
    if (node === home) return crossed;
    if (isFunction(node)) crossed = true;
  }
  return home === null && crossed;
}

/** The function a node sits in, or null at module level. */
function enclosingFunction(node: ESTree.Node): ESTree.Node | null {
  for (let parent: ESTree.Node | null = node.parent; parent !== null; parent = parent.parent) {
    if (isFunction(parent)) return parent;
  }
  return null;
}
