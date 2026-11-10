import type { Context } from "@oxlint/plugins";

/**
 * A rule's first options object, typed as its schema describes it. A rule whose schema requires
 * options cannot enforce anything without them, so a config that turns it on bare is refused.
 *
 * @template Options - The shape the rule's `meta.schema` requires.
 * @param context - The rule context.
 * @returns The configured options.
 * @throws Error naming the rule when the config passes no options.
 */
export function requiredOptions<Options extends object>(context: Context): Options {
  const [options] = context.options;
  if (options === undefined) {
    throw new Error(`${context.id} needs its options; the config turns it on without them.`);
  }
  // SAFETY: oxlint validates every configured options array against the rule's `meta.schema`
  // before `create` runs and refuses the config otherwise, so the first entry has that shape.
  return options as Options;
}
