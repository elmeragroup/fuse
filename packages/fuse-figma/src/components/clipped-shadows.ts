/**
 * The shadows of a variant's layers that reach past its root's top or bottom. Every kit root clips,
 * since Figma draws a spread ring only from a frame that clips (PR2), while a root whose `overflow`
 * is `visible` in CSS paints what its children's shadows reach past it (CSS Overflow 3 §3), as an
 * invalid Combobox caret's 3px ring reaches 1px past the 36px Input group at the dense density. The
 * build records each such shadow in the coverage table, so the clipped band is a known difference.
 *
 * The build holds a layer's height in each mode but not its width, so it measures how far a shadow
 * reaches past the root's top and bottom, through rows only: a row places each layer across its
 * height by its counter alignment, while a column places it after the layers above, whose heights
 * add up. It measures once with each variable's bounds across all modes, then in each mode view,
 * and trusts a measure only where every height and padding it reads holds one value there.
 */
import { heightBounds } from "./box-sizing";
import type { ModeView, VariableIndex } from "./css-values";
import { outOfLayout, strokeRoom } from "./kit-spec";
import type { BoxSpec, ChildLayerSpec, ComponentRootSpec, NumberSpec, ShadowSpec } from "./kit-spec";

/** A layer whose shadow reaches past the root, and how far in each measure that reaches it. */
export type ClippedShadow = {
  /** The layer's name, which the coverage row names as its part. */
  readonly part: string;
  /** The keys of the layers from the root down to the layer. */
  readonly path: readonly string[];
  /** The greatest reach in pixels past the root's top or bottom. */
  readonly reach: number;
  /** The edges of the root the shadow reaches past. */
  readonly edges: "top" | "bottom" | "top and bottom";
  /** The mode views the shadow reaches past the root in, or undefined where it does in every mode. */
  readonly modes: readonly string[] | undefined;
};

/** One measure: the variables, and the mode it names, or undefined for the bounds across all modes. */
type Measure = { readonly mode: string | undefined; readonly variables: VariableIndex };

/**
 * The shadows of a root's layers that reach past its top or bottom.
 *
 * @param root - The variant's root.
 * @param shadowsOf - The shadows an instance layer draws: its effects override, or its variant's own.
 * @param variables - The synced variables, with their bounds across all modes.
 * @param modes - Each mode view the build knows.
 * @returns Each layer whose shadow reaches past the root in some measure, in layer order.
 */
export function clippedShadows(
  root: ComponentRootSpec,
  shadowsOf: (layer: Extract<ChildLayerSpec, { readonly kind: "instance" }>) => readonly ShadowSpec[],
  variables: VariableIndex,
  modes: readonly ModeView[]
): readonly ClippedShadow[] {
  const measures: readonly Measure[] = [
    { mode: undefined, variables },
    ...modes.map((view) => ({ mode: view.name, variables: view.variables })),
  ];
  const found = new Map<
    string,
    {
      part: string;
      path: readonly string[];
      top: number;
      bottom: number;
      everyMode: boolean;
      modes: string[];
    }
  >();
  for (const measure of measures) {
    const height = exactHeight(asLayer(root), measure.variables);
    if (height === undefined) {
      continue;
    }
    for (const reached of reachesIn(root, [], 0, height, shadowsOf, measure.variables)) {
      const key = reached.path.join("/");
      const known = found.get(key) ?? {
        part: reached.part,
        path: reached.path,
        top: 0,
        bottom: 0,
        everyMode: false,
        modes: [],
      };
      known.top = Math.max(known.top, reached.top);
      known.bottom = Math.max(known.bottom, reached.bottom);
      if (measure.mode === undefined) {
        // The bounds across all modes give one height only where the heights hold one value in every mode.
        known.everyMode = true;
      } else {
        known.modes.push(measure.mode);
      }
      found.set(key, known);
    }
  }
  return [...found.values()].map(({ part, path, top, bottom, everyMode, modes: named }) => ({
    part,
    path,
    reach: Math.max(top, bottom),
    edges: top > 0 && bottom > 0 ? "top and bottom" : top > 0 ? "top" : "bottom",
    modes: everyMode ? undefined : named,
  }));
}

/** A reach past the root of one layer's shadow, in one measure, at the top and at the bottom. */
type Reach = {
  readonly part: string;
  readonly path: readonly string[];
  readonly top: number;
  readonly bottom: number;
};

/**
 * The reaches past the root of the shadows of a row's layers in flow, and of the layers of the rows
 * among them that do not clip, each placed by the row's counter alignment.
 */
function reachesIn(
  box: BoxSpec,
  path: readonly string[],
  top: number,
  rootHeight: number,
  shadowsOf: (layer: Extract<ChildLayerSpec, { readonly kind: "instance" }>) => readonly ShadowSpec[],
  variables: VariableIndex
): readonly Reach[] {
  const height = exactHeight(asLayer(box), variables);
  const strokeTop = exact(strokeRoom(box.stroke, "top"), variables);
  const strokeBottom = exact(strokeRoom(box.stroke, "bottom"), variables);
  const above = exact(box.paddingTop, variables);
  const below = exact(box.paddingBottom, variables);
  if (
    box.direction !== "HORIZONTAL" ||
    height === undefined ||
    strokeTop === undefined ||
    strokeBottom === undefined ||
    above === undefined ||
    below === undefined
  ) {
    return [];
  }
  const start = top + strokeTop + above;
  const room = height - strokeTop - strokeBottom - above - below;
  return box.children.flatMap((layer): readonly Reach[] => {
    if (layer.kind === "text" || layer.kind === "icon" || outOfLayout(layer)) {
      return [];
    }
    const own = layer.sizing.vertical.kind === "fill" ? room : exactHeight(layer, variables);
    const at = own === undefined ? undefined : placed(box, start, room, own);
    if (own === undefined || at === undefined) {
      return [];
    }
    const layerPath = [...path, layer.key];
    const shadows = layer.kind === "instance" ? shadowsOf(layer) : layer.shadows;
    const reaches = shadows.flatMap((shadow) => {
      const reach = shadowReach(shadow, at, rootHeight - at - own, variables);
      return reach === undefined ? [] : [reach];
    });
    const topReach = Math.max(0, ...reaches.map((reach) => reach.top));
    const bottomReach = Math.max(0, ...reaches.map((reach) => reach.bottom));
    const reached: readonly Reach[] =
      topReach > 0 || bottomReach > 0
        ? [{ part: layer.name, path: layerPath, top: topReach, bottom: bottomReach }]
        : [];
    const nested =
      layer.kind === "frame" && !layer.clips
        ? reachesIn(layer, layerPath, at, rootHeight, shadowsOf, variables)
        : [];
    return [...reached, ...nested];
  });
}

/** Where a row puts the top of a layer of a height, from the root's top, by its counter alignment. */
function placed(row: BoxSpec, start: number, room: number, height: number): number | undefined {
  switch (row.counterAlign) {
    case "MIN":
      return start;
    case "CENTER":
      return start + (room - height) / 2;
    case "MAX":
      return start + room - height;
    default:
      return undefined;
  }
}

/**
 * How far a shadow reaches past the root's top and bottom from a layer that sits `above` below the
 * root's top and `below` above its bottom: its spread and blur, shifted by its vertical offset.
 */
function shadowReach(
  shadow: ShadowSpec,
  above: number,
  below: number,
  variables: VariableIndex
): { readonly top: number; readonly bottom: number } | undefined {
  const spread = exact(shadow.spread, variables);
  const blur = exact(shadow.radius, variables);
  if (spread === undefined || blur === undefined) {
    return undefined;
  }
  return { top: spread + blur - shadow.offsetY - above, bottom: spread + blur + shadow.offsetY - below };
}

/** A number's one value under the variables, or undefined where it holds more than one. */
function exact(spec: NumberSpec, variables: VariableIndex): number | undefined {
  if (spec.kind === "literal") {
    return spec.value;
  }
  const least = variables.minimum(spec.variable);
  return least !== undefined && least === variables.maximum(spec.variable) ? least : undefined;
}

/**
 * A layer's one height under the variables, or undefined where it holds more than one. A layer a
 * BOOLEAN hides counts as shown, since a designer can show it.
 */
function exactHeight(layer: ChildLayerSpec, variables: VariableIndex): number | undefined {
  const shown = layer.kind === "frame" || layer.kind === "instance" ? withoutVisibility(layer) : layer;
  const { min, max } = heightBounds(shown, variables);
  return min === max ? max : undefined;
}

/** A frame or an instance as shown, without the BOOLEAN property that can hide it. */
function withoutVisibility<Layer extends { readonly visibleProperty?: string }>(layer: Layer): Layer {
  const { visibleProperty: _property, ...shown } = layer;
  // SAFETY: the copy lacks only `visibleProperty`, which `Layer` holds as optional.
  return shown as Layer;
}

/** A box as a frame layer, which `heightBounds` measures. */
function asLayer(box: BoxSpec): ChildLayerSpec {
  return { ...box, kind: "frame", key: "", name: "" };
}
