/**
 * The parts a set shows or hides behind a BOOLEAN property, and the properties the set lists for
 * them. Hiding a part's layer hides every layer inside it.
 */
import { KitUnmappable } from "./build-errors";
import { possibleCells } from "./component-spec";
import type { Cell, ComponentDefinition, PartDefinition } from "./component-spec";
import { allPartsOf, partsOf } from "./definition-parts";
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

/**
 * A definition's optional parts and icons, depth first, each with the property it hides behind.
 *
 * @param definition - The definition.
 * @param cells - Its cells, whose icons the icon slots list.
 * @param nameOf - The layer name of a frame part, which an error names.
 * @returns The parts.
 */
export function optionalParts(
  definition: ComponentDefinition,
  cells: readonly Cell[],
  nameOf: (part: PartDefinition) => string
): readonly OptionalPart[] {
  const parts = allPartsOf(definition).flatMap((part): OptionalPart[] =>
    part.optional === undefined
      ? []
      : [{ name: "kind" in part ? part.of.slot : nameOf(part), property: part.optional }]
  );
  // An icon is an `<svg>` with no slot, listed once by its key however many cells show it.
  const icons = new Map(
    [definition, ...partsOf(definition)].flatMap((box) =>
      cells.flatMap((cell) => box.iconsFor(cell).map((slot) => [slot.key, slot] as const))
    )
  );
  return [
    ...parts,
    ...[...icons.values()].flatMap((slot): OptionalPart[] =>
      slot.optional === undefined ? [] : [{ name: slot.name, property: slot.optional }]
    ),
  ];
}

/**
 * The BOOLEAN properties a set lists, each with its default, as the build gives the set them.
 *
 * @param definition - The set's definition.
 * @returns The properties, in the order the set lists them.
 * @throws When two parts give one property two defaults, as {@link booleanPropertiesOf} says.
 */
export function setBooleanProperties(definition: ComponentDefinition): readonly BooleanPropertySpec[] {
  return booleanPropertiesOf(
    definition.name,
    optionalParts(definition, possibleCells(definition), (part) => part.key)
  );
}

/**
 * The BOOLEAN properties that are on for an instance of a set: each at the value the instance gives
 * it, or else at its default.
 *
 * @param definition - The set's definition.
 * @param values - The instance's BOOLEAN values by property name, or undefined for the defaults.
 * @returns The names of the properties that are on.
 */
export function propertiesOn(
  definition: ComponentDefinition,
  values: Readonly<Record<string, boolean>> | undefined
): ReadonlySet<string> {
  return new Set(
    setBooleanProperties(definition)
      .filter(({ name, defaultValue }) => values?.[name] ?? defaultValue)
      .map(({ name }) => name)
  );
}
