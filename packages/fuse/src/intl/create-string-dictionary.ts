import { LocalizedStringDictionary } from "@internationalized/string";
import type { LocalizedString } from "@internationalized/string";

/**
 * Builds a component's four-locale dictionary.
 *
 * Every component owns its own rows, but the assembly was byte-identical in thirteen
 * `intl/index.ts` modules; this factory is that assembly. Naming the four locales as
 * named arguments rather than a `Record<SupportedLocale, …>` keeps a missing locale a
 * type error at the call site instead of a runtime lookup miss, and the shared `K`/`T`
 * parameters make the four row modules prove they carry the same keys.
 */
export function createStringDictionary<K extends string, T extends LocalizedString>(locales: {
  enUS: Record<K, T>;
  fiFI: Record<K, T>;
  nbNO: Record<K, T>;
  svSE: Record<K, T>;
}): LocalizedStringDictionary<K, T> {
  return new LocalizedStringDictionary({
    "en-US": locales.enUS,
    "fi-FI": locales.fiFI,
    "nb-NO": locales.nbNO,
    "sv-SE": locales.svSE,
  });
}
