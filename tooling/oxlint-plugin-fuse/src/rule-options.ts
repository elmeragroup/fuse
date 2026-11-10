import type { Context } from "@oxlint/plugins";

/**
 * A rule's first options object, typed as its schema describes it.
 *
 * @template Options - The shape the rule's `meta.schema` requires.
 * @param context - The rule context.
 * @returns The configured options, or `undefined` when the config passes none.
 */
export function ruleOptions<Options extends object>(context: Context): Options | undefined {
  // SAFETY: oxlint validates every configured options array against the rule's `meta.schema`
  // before `create` runs and refuses the config otherwise, so the first entry has that shape.
  return context.options[0] as Options | undefined;
}
