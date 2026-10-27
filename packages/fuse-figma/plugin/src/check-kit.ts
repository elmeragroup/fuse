/**
 * The kit check, which opens every planning pass. `checkKitSpec` in
 * `src/components/kit-check.ts` refuses a spec that contradicts itself, as the build does. This
 * module adds the checks against the file: a variable or mode the file lacks, and a variable of the
 * wrong type. It finds each error a later step of the run could meet. An operation that creates a
 * node plans the node's contents when it runs, so those plans can then look up nothing that fails.
 */

import { Result } from "effect";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { KitContradiction } from "../../src/components/kit-check.ts";
import { fixedLength, walkLayers } from "../../src/components/kit-spec.ts";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  FillSpec,
  InstanceOverride,
  KitSpec,
  NumberSpec,
  StringSpec,
  VariableRef,
} from "../../src/components/kit-spec.ts";
import { FileNotSynced } from "./errors.ts";
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

function boundColor(spec: FillSpec | undefined): BoundRef[] {
  return spec?.kind === "variable" ? [{ ref: spec.variable, type: "COLOR" }] : [];
}

function boundString(spec: StringSpec): BoundRef[] {
  return spec.kind === "variable" ? [{ ref: spec.variable, type: "STRING" }] : [];
}

/** The variables a box's own fields bind, its layers left out. */
function boxRefs(box: BoxSpec): BoundRef[] {
  return [
    ...[
      fixedLength(box.sizing.horizontal),
      fixedLength(box.sizing.vertical),
      box.limits.minWidth,
      box.limits.maxWidth,
      box.limits.minHeight,
      box.limits.maxHeight,
      box.paddingTop,
      box.paddingRight,
      box.paddingBottom,
      box.paddingLeft,
      box.itemSpacing,
      box.cornerRadius,
      box.stroke !== undefined && "weight" in box.stroke ? box.stroke.weight : undefined,
      ...box.shadows.flatMap((shadow) => [shadow.radius, shadow.spread]),
      box.backgroundBlur,
    ].flatMap(boundNumber),
    ...[box.fill, box.stroke?.color, ...box.shadows.map((shadow) => shadow.color)].flatMap(boundColor),
  ];
}

/** The variables an instance override binds. */
function overrideRefs(override: InstanceOverride): BoundRef[] {
  switch (override.field) {
    case "cornerRadius":
      return boundNumber(override.value);
    case "effects":
      return override.shadows.flatMap((shadow) => [
        ...boundNumber(shadow.radius),
        ...boundNumber(shadow.spread),
        ...boundColor(shadow.color),
      ]);
    case "textAlign":
      return [];
    default:
      return boundColor(override.color);
  }
}

/** The variables one layer's own fields bind. A frame's layers come from the walk. */
function layerRefs(layer: ChildLayerSpec): BoundRef[] {
  switch (layer.kind) {
    case "text":
      return [
        ...boundString(layer.fontFamily),
        ...[
          layer.fontSize,
          layer.lineHeight.kind === "percent" ? undefined : layer.lineHeight,
          fixedLength(layer.sizing.horizontal),
          fixedLength(layer.sizing.vertical),
          layer.maxWidth,
        ].flatMap(boundNumber),
        ...boundColor(layer.color),
      ];
    case "icon":
      return [...boundNumber(layer.size), ...boundColor(layer.color)];
    case "frame":
      return boxRefs(layer);
    case "instance":
      return [
        ...[fixedLength(layer.sizing.horizontal), fixedLength(layer.sizing.vertical), layer.minWidth].flatMap(
          boundNumber
        ),
        ...(layer.overrides ?? []).flatMap(overrideRefs),
      ];
  }
}

function rootRefs(root: ComponentRootSpec): BoundRef[] {
  return [...boxRefs(root), ...walkLayers(root).flatMap(layerRefs)];
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
 * Check the kit against itself, as `checkKitSpec` does at build time, and against the file's
 * variables. The planning pass calls this before it records any operation.
 *
 * @param figma - The plugin API, which decodes the kit's images.
 * @param variables - The file's variables.
 * @param kit - The kit.
 * @returns Nothing, or `KitContradiction` when the spec contradicts itself, and `FileNotSynced`
 *   when the file lacks a variable or mode the kit names or a variable has the wrong type.
 */
export function checkKit(
  figma: PluginAPI,
  variables: KitVariables,
  kit: KitSpec
): Result.Result<void, KitContradiction | FileNotSynced> {
  return Result.gen(function* () {
    yield* checkKitSpec(kit, (text) => figma.base64Decode(text));
    for (const preview of kit.previews) {
      for (const ref of preview.modes) {
        yield* variables.findMode(ref);
      }
    }
    for (const { ref, type } of boundRefs(kit)) {
      const variable = yield* variables.findVariable(ref);
      if (variable.resolvedType !== type) {
        return yield* Result.fail(
          new FileNotSynced({
            message: `${variableLabel(ref)} is a ${variable.resolvedType} variable, and the kit binds it to a field that takes a ${type}. Run \`figma:sync\` on this file first.`,
            collection: ref.collection,
          })
        );
      }
    }
  });
}
