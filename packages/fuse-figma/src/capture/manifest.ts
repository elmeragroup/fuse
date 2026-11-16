/**
 * A set's manifest: the intent the capture-backed build reads beside the capture. It names the
 * props matrix, the sample content, the property names, the instance boundaries and keys and the
 * parts that take the set's states. It holds no CSS knowledge: no classes, no facts, no omitted
 * states and no element selectors, since the capture holds what the browser made of them.
 */

import type {
  ComponentDefinition,
  InstanceDefinition,
  LabelDefinition,
  PartDefinition,
} from "../components/component-spec.ts";

/**
 * The fields of a definition that hold CSS knowledge, which a manifest leaves out: the classes,
 * the state table's inputs and omissions, the element selectors and the declarations around and on
 * the root that the definition models by hand. `elementSlot` stays: it names the `data-slot` a family
 * stamps on a shared root, which is how the capture finds the root.
 */
export const FORBIDDEN_FIELDS = [
  "classesFor",
  "facts",
  "states",
  "omittedStates",
  "omittedPseudoElements",
  "omittedCompositions",
  "omittedMedia",
  "element",
  "statePartElement",
  "rootKind",
  "inheritedFor",
  "ancestorsFor",
  "elementDefaults",
  "styleFor",
  "textElement",
  "ownClassesFor",
  "swapClasses",
  "stamps",
] as const;

type Forbidden = (typeof FORBIDDEN_FIELDS)[number];

/** `Omit` over each member of a union, which keeps the union. */
type OmitEach<Type, Key extends PropertyKey> = Type extends unknown ? Omit<Type, Key> : never;

/** A label as a manifest names it: its key, name, sample text, property and placement. */
export type LabelManifest = OmitEach<LabelDefinition, Forbidden>;

/**
 * A part as a manifest names it: its key, its `data-slot` or its place, its text, its icons and the
 * parts below it.
 */
export type PartManifest = OmitEach<PartDefinition, Forbidden | "label" | "parts"> & {
  readonly label: LabelManifest | undefined;
  readonly parts?: readonly (PartManifest | InstanceManifest)[];
};

/** An instance part as a manifest names it: its key, the inner set's manifest, its cell and its values. */
export type InstanceManifest = Omit<InstanceDefinition, Forbidden | "of" | "classesFor"> & {
  readonly of: SetManifest;
};

/** A component set's manifest. */
export type SetManifest = Omit<ComponentDefinition, Forbidden | "label" | "parts"> & {
  readonly label: LabelManifest | undefined;
  readonly parts?: readonly (PartManifest | InstanceManifest)[];
};

/** The definition the mapper walks for a manifest part. */
function partDefinition(part: PartManifest | InstanceManifest): PartDefinition | InstanceDefinition {
  if ("kind" in part) {
    return { ...part, of: manifestDefinition(part.of) };
  }
  const { parts, ...rest } = part;
  const definition: PartDefinition = { ...rest, classesFor: () => "" };
  return parts === undefined ? definition : { ...definition, parts: parts.map(partDefinition) };
}

/**
 * The definition the mapper walks for a manifest: the manifest's intent, with no classes, facts or
 * states, which the capture-backed cascade does not read.
 *
 * @param manifest - The manifest.
 * @returns The definition.
 */
export function manifestDefinition(manifest: SetManifest): ComponentDefinition {
  const { parts, ...rest } = manifest;
  const definition: ComponentDefinition = {
    ...rest,
    classesFor: () => "",
    facts: new Map(),
    states: {},
    omittedStates: new Set(),
  };
  return parts === undefined ? definition : { ...definition, parts: parts.map(partDefinition) };
}
