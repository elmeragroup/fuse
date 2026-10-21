/**
 * The kit check, which opens every planning pass. It finds each error a later step of the
 * run could meet: a variable or mode the file lacks, a variable of the wrong type, or a spec
 * that contradicts itself. An operation that creates a node plans the node's contents when it
 * runs, so those plans can then look up nothing that fails.
 */

import type {
  ColorSpec,
  ComponentRootSpec,
  KitSpec,
  NumberSpec,
  StringSpec,
  VariableRef,
} from "../../src/components/kit-spec.ts";
import { checkComponentSet } from "./component-set.ts";
import { variableLabel } from "./fields.ts";
import { PREVIEW_BACKGROUND } from "./previews.ts";
import type { KitVariables } from "./variables.ts";

/** A variable the kit binds, and the type the bound field needs. */
type BoundRef = {
  readonly ref: VariableRef;
  readonly type: VariableResolvedDataType;
};

function boundNumber(spec: NumberSpec | undefined): BoundRef[] {
  return spec?.kind === "variable" ? [{ ref: spec.variable, type: "FLOAT" }] : [];
}

function boundColor(spec: ColorSpec | undefined): BoundRef[] {
  return spec?.kind === "variable" ? [{ ref: spec.variable, type: "COLOR" }] : [];
}

function boundString(spec: StringSpec): BoundRef[] {
  return spec.kind === "variable" ? [{ ref: spec.variable, type: "STRING" }] : [];
}

function rootRefs(root: ComponentRootSpec): BoundRef[] {
  return [
    ...[
      root.width,
      root.height,
      root.minWidth,
      root.paddingTop,
      root.paddingRight,
      root.paddingBottom,
      root.paddingLeft,
      root.itemSpacing,
      root.cornerRadius,
      root.stroke?.weight,
      ...root.shadows.flatMap((shadow) => [shadow.radius, shadow.spread]),
    ].flatMap(boundNumber),
    ...[root.fill, root.stroke?.color, ...root.shadows.map((shadow) => shadow.color)].flatMap(boundColor),
    ...root.children.flatMap((child) =>
      child.kind === "text"
        ? [
            ...boundString(child.fontFamily),
            ...boundNumber(child.fontSize),
            ...boundNumber(child.lineHeight),
            ...boundColor(child.color),
          ]
        : [...boundNumber(child.size), ...boundColor(child.color)]
    ),
  ];
}

/**
 * Every variable the run binds: the sets', the icon library's glyph color, and the background
 * the previews and the library paint.
 */
function boundRefs(kit: KitSpec): BoundRef[] {
  const refs = kit.componentSets.flatMap((set) => set.variants.flatMap((variant) => rootRefs(variant.root)));
  return [...refs, ...boundColor(kit.icons.color), { ref: PREVIEW_BACKGROUND, type: "COLOR" }];
}

/**
 * The collections the run reads, through the variables it binds and the modes the previews
 * pin.
 *
 * @param kit - The kit.
 * @returns The collection names.
 */
export function kitCollections(kit: KitSpec): ReadonlySet<string> {
  return new Set([
    ...boundRefs(kit).map(({ ref }) => ref.collection),
    ...kit.previews.flatMap((preview) => preview.modes.map((mode) => mode.collection)),
  ]);
}

/**
 * Check the kit against itself and against the file's variables. The planning pass calls this
 * before it records any operation.
 *
 * @param variables - The file's variables.
 * @param kit - The kit.
 * @throws When the file lacks a variable or mode the kit names, a variable has the wrong type,
 *   or the spec contradicts itself.
 */
export function checkKit(variables: KitVariables, kit: KitSpec): void {
  for (const set of kit.componentSets) {
    checkComponentSet(set);
  }
  for (const preview of kit.previews) {
    const set = kit.componentSets.find((candidate) => candidate.key === preview.componentSet);
    if (set === undefined) {
      throw new Error(
        `${preview.name} places variants of ${preview.componentSet}, which the kit does not define.`
      );
    }
    for (const variant of preview.variants) {
      if (!set.variants.some((candidate) => candidate.key === variant)) {
        throw new Error(`${preview.name} places ${variant}, which ${set.name} does not define.`);
      }
    }
    for (const ref of preview.modes) {
      variables.mode(ref);
    }
  }
  for (const { ref, type } of boundRefs(kit)) {
    const variable = variables.variable(ref);
    if (variable.resolvedType !== type) {
      throw new Error(
        `${variableLabel(ref)} is a ${variable.resolvedType} variable, and the kit binds it to a field that takes a ${type}. Run \`figma:sync\` on this file first.`
      );
    }
  }
}
