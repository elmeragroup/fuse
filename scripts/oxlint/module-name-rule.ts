import { filenameOf, isOneOf } from "./rule-kit.ts";
import type { Rule } from "./rule-kit.ts";

/**
 * Vague module names. A test suffix (`utils.test.ts`) names a test, not the module, so only a file
 * whose name before its last extension is exactly a banned word matches.
 */
const VAGUE_MODULE_NAME = /^(?:utils|helpers|common|misc)$/u;

/**
 * The one module the rule lets through. It keeps its name until the `@elmeragroup/internal`
 * focus-ring rules take the owner path as a rule option.
 */
export const ALLOWED_VAGUE_MODULES: readonly string[] = ["/packages/fuse/src/styles/utils.ts"];

/** Modules are named after what they own. */
export const noVagueModuleName: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Ban the vague module names utils, helpers, common and misc." },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const filename = filenameOf(context);
        const basename = filename.slice(filename.lastIndexOf("/") + 1);
        const name = basename.slice(0, basename.lastIndexOf("."));
        if (!VAGUE_MODULE_NAME.test(name) || isOneOf(context, ALLOWED_VAGUE_MODULES)) return;
        context.report({
          node,
          message: `Name the module after what it owns; ${basename} uses a banned vague name (utils, helpers, common, misc).`,
        });
      },
    };
  },
};
