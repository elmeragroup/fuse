/**
 * The parts a set shows or hides behind a BOOLEAN property, and the properties the set lists for
 * them. Hiding a part's layer hides every layer inside it.
 */
import { KitUnmappable } from "./build-errors";
import type { BooleanPropertySpec } from "./kit-spec";

/** An optional part, as the set's properties need it. */
export type OptionalPart = {
  /** The part's layer name. */
  readonly name: string;
  /** The property the part hides behind. */
  readonly property: BooleanPropertySpec;
};

/**
 * The BOOLEAN properties the optional parts hide behind, each once, in the order the parts first
 * name them. One property holds one default, so two parts that name it must start the same.
 *
 * @param set - The set's name, for the error.
 * @param parts - The optional parts, depth first.
 * @returns The properties.
 * @throws When two parts give one property two defaults, naming both parts.
 */
export function booleanPropertiesOf(
  set: string,
  parts: readonly OptionalPart[]
): readonly BooleanPropertySpec[] {
  const named = new Map<string, { readonly defaultValue: boolean; readonly part: string }>();
  for (const { name, property } of parts) {
    const first = named.get(property.name);
    if (first === undefined) {
      named.set(property.name, { defaultValue: property.defaultValue, part: name });
    } else if (first.defaultValue !== property.defaultValue) {
      throw new KitUnmappable({
        message: `${set}: the parts ${first.part} and ${name} both hide behind the ${property.name} property, one starting ${String(first.defaultValue)} and one ${String(property.defaultValue)}. A BOOLEAN property holds one default, so give them one default or a property each.`,
      });
    }
  }
  return [...named].map(([name, { defaultValue }]) => ({ name, defaultValue }));
}
