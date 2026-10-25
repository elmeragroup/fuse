/**
 * The parts a set shows or hides behind a BOOLEAN property: the properties the set lists, and the
 * refusal of a part whose presence a class of the set reads. Hiding a part's layer hides every
 * layer inside it, while a selector that reads a part's presence restyles its own box once the part
 * is gone, which a BOOLEAN property cannot do.
 */
import { slotReadsOf } from "./css-selector";
import type { SlotReads } from "./css-selector";
import type { BooleanPropertySpec } from "./kit-spec";

/** An optional part, as the set's properties and the presence check need it. */
export type OptionalPart = {
  /** The part's layer name. */
  readonly name: string;
  /** The property the part hides behind. */
  readonly property: BooleanPropertySpec;
  /** Each `data-slot` that hiding the part hides: its own, if it has one, and every part's inside it. */
  readonly slots: readonly string[];
  /**
   * Each element type that hiding the part hides and a selector can test by its type alone: `svg`
   * for an optional icon. Empty for a frame or an instance part, which the build finds by its slot.
   */
  readonly elements: readonly string[];
  /**
   * For a part of an instance's inner set: the instance, by the keys of the instance parts from the
   * set down to it, and the inner set whose property the part hides behind, which lists it. Undefined
   * for a part of the set's own.
   */
  readonly inside: { readonly instance: string; readonly set: string } | undefined;
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
      throw new Error(
        `${set}: the parts ${first.part} and ${name} both hide behind the ${property.name} property, one starting ${String(first.defaultValue)} and one ${String(property.defaultValue)}. A BOOLEAN property holds one default, so give them one default or a property each.`
      );
    }
  }
  return [...named].map(([name, { defaultValue }]) => ({ name, defaultValue }));
}

/**
 * Refuse an optional part when a class of the set reads, through a `data-slot` inside `:has()`,
 * whether the part or a part inside it is there, as `item-described:` reads whether Item holds a
 * description, or, for an optional icon, through an `svg` inside `:has()`, as `has-[>svg]:` does. Every rule that names the class counts, whatever its selector starts with. A rule
 * the scanner cannot read refuses too, since it may read such a slot. An optional part of an
 * instance's inner set counts too: a designer hides it on the instance, exposed or not, and the
 * set's class reads it all the same.
 *
 * @param set - The set's name, for the error.
 * @param parts - The optional parts.
 * @param classes - Every class the set uses, in any cell, on any box or icon.
 * @param rulesByClass - The selectors of the rules that name each class.
 * @throws When a class reads an optional part's presence, naming the class and its `:has()`, or
 *   names a rule the scanner cannot read.
 */
export function refusePresenceReads(
  set: string,
  parts: readonly OptionalPart[],
  classes: ReadonlySet<string>,
  rulesByClass: ReadonlyMap<string, readonly string[]>
): void {
  const reads = new Map<string, SlotReads>();
  const readsOf = (selector: string): SlotReads => {
    const read = reads.get(selector) ?? slotReadsOf(selector);
    reads.set(selector, read);
    return read;
  };
  for (const part of parts) {
    const { inside } = part;
    const holder = inside === undefined ? part.name : `${part.name} in the ${inside.instance} instance`;
    const hides =
      inside === undefined
        ? `${holder} cannot hide behind the ${part.property.name} property`
        : `${holder} cannot hide behind ${inside.set}'s ${part.property.name} property`;
    for (const className of classes) {
      for (const selector of rulesByClass.get(className) ?? []) {
        const read = readsOf(selector);
        if (read.kind === "unreadable") {
          throw new Error(
            `${set}: ${hides}, since the build cannot tell which parts \`${className}\` reads: ${read.reason}.`
          );
        }
        const test =
          read.tests.find(({ slot }) => part.slots.includes(slot)) ??
          read.elements.find(({ element }) => part.elements.includes(element));
        if (test !== undefined) {
          const found = "slot" in test ? test.slot : part.name;
          const what = found === part.name ? "it" : `${found}, which ${holder} holds,`;
          throw new Error(
            `${set}: ${hides}, since \`${className}\` reads whether ${what} is there through \`${test.clause}\`. A BOOLEAN property hides a layer and cannot restyle the box that reads it, so give the part's presence a variant axis instead.`
          );
        }
      }
    }
  }
}
