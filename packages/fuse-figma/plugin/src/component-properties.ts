/**
 * Component properties by name. Figma keys a TEXT, BOOLEAN or INSTANCE_SWAP property by an id of the
 * form `Name#id`, which changes when the property is added again or renamed, so the plugin finds each
 * property by the name before the `#`. This module is the only planner code that reads a property id.
 * The tests and `fake-figma.ts` parse ids on their own, so they stay an independent check of it.
 */

import { change } from "./plan.ts";
import type { PlanRecorder } from "./plan.ts";

/**
 * The name a property id carries.
 *
 * @param id - A property id, such as `Label#12:3`.
 * @returns The part before the `#`, such as `Label`.
 */
export function propertyName(id: string): string {
  return id.split("#")[0] ?? id;
}

/**
 * Find a property of a type by its name, among a set's definitions or an instance's values.
 *
 * @param properties - The properties by id.
 * @param type - The property type.
 * @param name - The property name.
 * @returns The id and the property, or undefined when none has that type and name.
 */
export function findProperty<Property extends { readonly type: ComponentPropertyType }>(
  properties: Readonly<Record<string, Property>>,
  type: ComponentPropertyType,
  name: string
): readonly [string, Property] | undefined {
  return Object.entries(properties).find(
    ([id, property]) => property.type === type && propertyName(id) === name
  );
}

/** A property a set should define, and how the plan adds it or brings its definition in line. */
export type SetProperty = {
  readonly name: string;
  readonly type: ComponentPropertyType;
  /** The change line for adding the property. */
  readonly addLine: string;
  /** Adds the property when its operation runs, and returns its id. */
  readonly add: () => string;
  /** Whether the set's definition already matches the spec. */
  readonly holds: (definition: ComponentPropertyDefinitions[string]) => boolean;
  /** The change line for bringing the definition in line. */
  readonly editLine: string;
  /** Edits the definition with the given id when its operation runs, and returns its new id. */
  readonly edit: (id: string) => string;
};

/**
 * Plan one property of a set: add it when the set lacks it, and edit it when its definition differs
 * from the spec. The property's id goes into `ids` now for a held property, and when the operation
 * runs for an added or edited one, since an edit can change the id.
 *
 * @param plan - The plan.
 * @param set - The component set.
 * @param label - The set's label in change lines.
 * @param property - The property.
 * @param ids - The set's property ids by name.
 */
export function planSetProperty(
  plan: PlanRecorder,
  set: ComponentSetNode,
  label: string,
  property: SetProperty,
  ids: Map<string, string>
): void {
  const found = findProperty(set.componentPropertyDefinitions, property.type, property.name);
  if (found === undefined) {
    change(plan, label, property.addLine, () => {
      ids.set(property.name, property.add());
    });
    return;
  }
  const [id, definition] = found;
  ids.set(property.name, id);
  if (!property.holds(definition)) {
    change(plan, label, property.editLine, () => {
      ids.set(property.name, property.edit(id));
    });
  }
}
