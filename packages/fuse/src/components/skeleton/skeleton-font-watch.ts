/**
 * Package-private. Tells a skeleton when the fonts its ghost may use change, which a font-set event
 * does not always tell: no engine fires one when a face that already loaded is added to the
 * document, `new FontFace(…).load()` then `document.fonts.add(face)` as MDN shows it, and WebKit
 * can leave `loadingdone` out for a face that loads in the set. The set itself does tell. One frame
 * loop per document compares its faces, each by identity and status, with the frame before, only
 * while a skeleton watches it, and calls each watcher on a change. Counting faces would not do: a
 * host swapping its brand face for another loaded one in one task keeps the count and the status.
 *
 * Cost: the set holds the page's `@font-face` rules and the faces scripts added, a few dozen at
 * most, so a frame reads that many references and strings, stopping at the first difference, and
 * allocates nothing unless the set changed. That is negligible beside a frame's layout and paint.
 */
import { windowOf } from "../../internal/dom-node";

/** The faces a set held at a frame, in its order, with the status each had. */
type FontSetSnapshot = {
  readonly faces: readonly FontFace[];
  readonly statuses: readonly FontFaceLoadStatus[];
};

/** One document's watch: its watchers, the set as last seen, and the frame read next. */
type FontSetWatch = { readonly watchers: Set<() => void>; seen: FontSetSnapshot; frame: number };

const watches = new WeakMap<Document, FontSetWatch>();

/** The set's faces and their statuses, now. */
function snapshotOf(fonts: FontFaceSet): FontSetSnapshot {
  const faces: FontFace[] = [];
  const statuses: FontFaceLoadStatus[] = [];
  fonts.forEach((face) => {
    faces.push(face);
    statuses.push(face.status);
  });
  return { faces, statuses };
}

/** Whether the set holds other faces than `seen`, or one of them in another status. */
function changedSince(fonts: FontFaceSet, seen: FontSetSnapshot): boolean {
  let index = 0;
  for (const face of fonts) {
    if (seen.faces[index] !== face || seen.statuses[index] !== face.status) return true;
    index += 1;
  }
  return index !== seen.faces.length;
}

/**
 * Calls `onChange` each time the fonts of `node`'s document change: a face added, removed or
 * replaced, or one starting or finishing a load. It runs from the document's own animation
 * frames, before layout, so a measure it makes reads the fonts the frame lays out with.
 *
 * @param node - A node in the document to watch, which may be a same-origin frame's.
 * @param onChange - Called once per change.
 * @returns Stops the watch; the frame loop stops with the document's last watcher.
 */
export function watchFontSet(node: Node, onChange: () => void): () => void {
  const view = windowOf(node);
  const { document } = view;
  let watch = watches.get(document);
  if (watch === undefined) {
    watch = { watchers: new Set(), seen: snapshotOf(document.fonts), frame: 0 };
    watches.set(document, watch);
  }
  const current = watch;
  if (current.watchers.size === 0) {
    current.seen = snapshotOf(document.fonts);
    const read = (): void => {
      if (changedSince(document.fonts, current.seen)) {
        current.seen = snapshotOf(document.fonts);
        for (const watcher of [...current.watchers]) watcher();
      }
      current.frame = view.requestAnimationFrame(read);
    };
    current.frame = view.requestAnimationFrame(read);
  }
  current.watchers.add(onChange);
  return () => {
    current.watchers.delete(onChange);
    if (current.watchers.size > 0) return;
    view.cancelAnimationFrame(current.frame);
    current.frame = 0;
  };
}
