/**
 * Which layer draws each part of a cell: the build's own record of where each part's element sits in
 * the capture, the `data-slot` it carries, and the key path of the layer that draws its border box.
 * `box-mapping.ts` notes each part's layer once its box has placed it, each icon's, and each part it
 * leaves out, and the builder reads the paths from the variant's finished root.
 *
 * The layer that draws a part's border box is not always the layer its parent holds. A part with
 * margins sits in a frame that draws them, as the `box` inside it. A part that scales draws its
 * scaled box in the `dot` its slot centers, and the browser measures that scaled box. A placed
 * instance at its parent's end sits in a placement wrapper. An icon with margins sits in a frame of
 * them as the `box` inside it. A part of an element that generates no box lifts into its parent under
 * the key `wrapper/part`, and a content box adds a `content` frame between a box and its parts. The
 * mapping hands the record the exact layer at each of these steps, so the record reads no layer's
 * place from its key. `figma:probe` pairs each box it measures with its part through this record.
 */
import { KitUnmappable } from "./build-errors";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  IconLayerSpec,
  InstanceLayerSpec,
} from "./kit-spec";

/** Where a box's element sits in its cell's capture, as `capture-cascade.ts` names places, and its `data-slot`. */
export type DrawnAt = { readonly place: string; readonly slot: string | undefined };

/** A layer that draws a part's or an icon's border box. */
export type BorderLayer = FrameLayerSpec | InstanceLayerSpec | IconLayerSpec;

/**
 * One part of a cell as the build drew it: its element's place and `data-slot`, its key, and the key
 * path from the variant's root to the layer that draws its border box, `[]` for the root itself, or
 * undefined for a part the build leaves out, as an empty part that paints nothing.
 */
export type DrawnPart = DrawnAt & { readonly part: string; readonly path: readonly string[] | undefined };

/** A part's layer as the mapping noted it, or a part it left out. */
type Noted = DrawnAt & { readonly part: string; readonly layer: BorderLayer | undefined };

/** The parts a cell's mapping draws and leaves out, which {@link DrawnParts.resolve} reads once the root is built. */
export class DrawnParts {
  readonly #noted: Noted[] = [];

  /**
   * Note the layer that draws a part's or an icon's border box, once its box has placed it.
   *
   * @param at - Where the element sits, or undefined for a part without an element of its own.
   * @param part - The part's or the icon's key.
   * @param layer - The layer.
   */
  note(at: DrawnAt | undefined, part: string, layer: BorderLayer): void {
    if (at !== undefined) {
      this.#noted.push({ ...at, part, layer });
    }
  }

  /**
   * Note a part the mapping leaves out, which no layer draws.
   *
   * @param at - Where the part's element sits, or undefined for a part without an element of its own.
   * @param part - The part's key.
   */
  omit(at: DrawnAt | undefined, part: string): void {
    if (at !== undefined) {
      this.#noted.push({ ...at, part, layer: undefined });
    }
  }

  /**
   * Each part of the cell with the key path to its layer in the finished root, the root first.
   *
   * @param root - The variant's finished root.
   * @param at - Where the root's element sits, or undefined for an open composite's composed root.
   * @param variant - The variant's key, for errors.
   * @returns The cell's parts.
   * @throws `KitUnmappable` where a noted layer is not in the root, where its path passes a key that
   *   another layer beside it shares, so the path names more than one layer, or where two parts share
   *   a place, each a defect of the build.
   */
  resolve(root: ComponentRootSpec, at: DrawnAt | undefined, variant: string): readonly DrawnPart[] {
    // Each layer's path, and whether some step of it is a key two layers beside each other share.
    const paths = new Map<ChildLayerSpec, { readonly path: readonly string[]; readonly shared: boolean }>();
    const visit = (layers: readonly ChildLayerSpec[], above: readonly string[], shared: boolean): void => {
      const counts = new Map<string, number>();
      for (const { key } of layers) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      for (const layer of layers) {
        const path = [...above, layer.key];
        const here = shared || (counts.get(layer.key) ?? 0) > 1;
        paths.set(layer, { path, shared: here });
        if (layer.kind === "frame") {
          visit(layer.children, path, here);
        }
      }
    };
    visit(root.children, [], false);
    const parts: DrawnPart[] = [
      ...(at === undefined ? [] : [{ ...at, part: root.name, path: [] }]),
      ...this.#noted.map(({ layer, ...part }): DrawnPart => {
        if (layer === undefined) {
          return { ...part, path: undefined };
        }
        const found = paths.get(layer);
        if (found === undefined || found.shared) {
          throw new KitUnmappable({
            message: `${variant}: the layer of the part ${part.part} at ${part.place} ${found === undefined ? "is not in the variant's root" : `has the path ${found.path.join("/")}, which another layer's key beside it shares`}`,
          });
        }
        return { ...part, path: found.path };
      }),
    ];
    const seen = new Set<string>();
    for (const { place, part } of parts) {
      if (seen.has(place)) {
        throw new KitUnmappable({
          message: `${variant}: two parts draw the element at ${place}, one of them ${part}`,
        });
      }
      seen.add(place);
    }
    return parts;
  }
}
