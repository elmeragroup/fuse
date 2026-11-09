/**
 * Package-private. Tells a skeleton when the fonts its ghost may use change, which a font-set event
 * does not always tell: no engine fires one when a face that already loaded is added to the
 * document, `new FontFace(…).load()` then `document.fonts.add(face)` as MDN shows it, and WebKit
 * can leave `loadingdone` out for a face that loads in the set. The set's own state does tell: its
 * size changes when a face is added, and its status when loads start and finish. One frame loop per
 * document reads that state, only while a skeleton watches it, and calls each watcher on a change.
 */
import { windowOf } from "../../internal/dom-node";

/** One document's watch: its watchers, the state last seen, and the frame read next. */
type FontSetWatch = { readonly watchers: Set<() => void>; state: string; frame: number };

const watches = new WeakMap<Document, FontSetWatch>();

/** The font set's state a change of fonts shows in: how many faces it holds, and whether any loads. */
function stateOf(fonts: FontFaceSet): string {
  return `${String(fonts.size)}:${fonts.status}`;
}

/**
 * Calls `onChange` each time the fonts of `node`'s document change: a face added or removed, or
 * loads starting or finishing. It runs from the document's own animation frames, before layout,
 * so a measure it makes reads the fonts the frame lays out with.
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
    watch = { watchers: new Set(), state: stateOf(document.fonts), frame: 0 };
    watches.set(document, watch);
  }
  const current = watch;
  if (current.watchers.size === 0) {
    current.state = stateOf(document.fonts);
    const read = (): void => {
      const state = stateOf(document.fonts);
      if (state !== current.state) {
        current.state = state;
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
