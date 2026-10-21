/**
 * The kit check, which opens every planning pass. It finds each error a later step of the
 * run could meet: a variable or mode the file lacks, a variable of the wrong type, or a spec
 * that contradicts itself. An operation that creates a node plans the node's contents when it
 * runs, so those plans can then look up nothing that fails.
 */

import { topLevelSpecs } from "../../src/components/kit-spec.ts";
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
 *   or the spec contradicts itself, such as a page key listed twice, a node on a page the kit
 *   does not list, or a preview that places a set from another page.
 */
export function checkKit(variables: KitVariables, kit: KitSpec): void {
  const pages = new Set<string>();
  for (const page of kit.pages) {
    if (pages.has(page.key)) {
      throw new Error(`The kit lists the page key ${page.key} twice.`);
    }
    pages.add(page.key);
  }
  for (const { name, page } of topLevelSpecs(kit)) {
    if (!pages.has(page)) {
      throw new Error(`${name} sits on the page ${page}, which the kit does not list.`);
    }
  }
  for (const set of kit.componentSets) {
    checkComponentSet(set);
  }
  for (const preview of kit.previews) {
    for (const group of preview.groups) {
      const set = kit.componentSets.find((candidate) => candidate.key === group.componentSet);
      if (set === undefined) {
        throw new Error(
          `${preview.name} places variants of ${group.componentSet}, which the kit does not define.`
        );
      }
      if (set.page !== preview.page) {
        throw new Error(`${preview.name} places ${set.name}, which sits on another page.`);
      }
      const variants = new Set(set.variants.map((variant) => variant.key));
      for (const variant of group.variants) {
        if (!variants.has(variant)) {
          throw new Error(`${preview.name} places ${variant}, which ${set.name} does not define.`);
        }
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
