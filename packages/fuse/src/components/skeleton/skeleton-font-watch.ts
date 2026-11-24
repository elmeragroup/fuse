/**
 * Tells a skeleton when the fonts its ghost may use change. It is package-private. The font-set
 * events miss two kinds of change. No engine fires one when a face that already loaded is added,
 * as in MDN's `new FontFace(…).load()` then `document.fonts.add(face)`. `loadingdone` waits for
 * every outstanding load, so a request held open hides each face that loads meanwhile, and WebKit
 * can leave it out.
 *
 * While a skeleton watches a document, one watch checks the document's set on a set event, when a
 * face it follows settles, on a timer while the document is visible, and when the document shows
 * again. The timer finds a loaded face added and a face added while the set was already loading.
 * The watch requests no animation frame, so a skeleton that stays up does not wake the main thread
 * each frame while only the compositor runs its pulse.
 */
import { windowOf } from "../../internal/dom-node";

/**
 * How often, in milliseconds, the timer checks the set. A face added by script is rare, and a
 * skeleton drawn in the fallback font for a second is still a placeholder.
 */
const RECHECK_MS = 1000;

/** The set events that start a check. */
const FONT_SET_EVENTS = ["loading", "loadingdone", "loadingerror"] as const;

/** The faces a set held when it was last read, in its order, with the status each had. */
type FontSetSnapshot = {
  readonly faces: readonly FontFace[];
  readonly statuses: readonly FontFaceLoadStatus[];
};

/** One document's running watch: its watchers, and the functions that check and stop it. */
type FontSetWatch = {
  readonly watchers: Set<() => void>;
  readonly check: () => void;
  readonly stop: () => void;
};

/**
 * One document's faces whose `loaded` the watch follows, and its running watch, or `null` between
 * its last watcher and its next. A face's reaction reaches only this record, so a face that never
 * settles keeps no stopped watch, and through it no document, alive.
 */
type FontSetRecord = { readonly followed: WeakSet<FontFace>; active: FontSetWatch | null };

const records = new WeakMap<Document, FontSetRecord>();

/** The set's faces and their statuses, now. Follows each face that has neither loaded nor failed. */
function snapshotOf(fonts: FontFaceSet, record: FontSetRecord): FontSetSnapshot {
  const faces: FontFace[] = [];
  const statuses: FontFaceLoadStatus[] = [];
  const check = (): void => {
    record.active?.check();
  };
  // A loop, not `forEach`. In Chromium a callback that reads `faces` puts it in the scope `check`
  // shares, so a face that never settles would keep `faces` and a detached frame's document alive.
  for (const face of fonts) {
    faces.push(face);
    statuses.push(face.status);
    if (face.status === "loaded" || face.status === "error" || record.followed.has(face)) continue;
    record.followed.add(face);
    face.loaded.then(check, check);
  }
  return { faces, statuses };
}

/**
 * Whether the set holds other faces than `seen`, or one of them in another status. Counting faces
 * would not work, since a host swapping its brand face for another loaded one in one task keeps the
 * count and the status.
 */
function changedSince(fonts: FontFaceSet, seen: FontSetSnapshot): boolean {
  let index = 0;
  for (const face of fonts) {
    if (seen.faces[index] !== face || seen.statuses[index] !== face.status) return true;
    index += 1;
  }
  return index !== seen.faces.length;
}

/**
 * Whether `view` still shows `document`. Once a frame navigates, `view` shows another document,
 * and reading `view.document` throws after a cross-origin navigation.
 */
function showsDocument(view: Window, document: Document): boolean {
  try {
    return view.document === document;
  } catch {
    return false;
  }
}

/** Starts the watch of `document`, shown in `view`, with no watchers yet. */
function startWatch(view: Window, document: Document, record: FontSetRecord): FontSetWatch {
  const { fonts } = document;
  const watchers = new Set<() => void>();
  let seen = snapshotOf(fonts, record);
  const check = (): void => {
    if (!showsDocument(view, document) || !changedSince(fonts, seen)) return;
    seen = snapshotOf(fonts, record);
    for (const watcher of [...watchers]) watcher();
  };
  let timer: number | undefined;
  const pause = (): void => {
    // A navigated frame's timers reuse ids, so clearing this one there could clear one of theirs.
    if (timer !== undefined && showsDocument(view, document)) view.clearInterval(timer);
    timer = undefined;
  };
  const followVisibility = (): void => {
    if (document.visibilityState !== "visible") {
      pause();
      return;
    }
    check();
    if (timer === undefined && showsDocument(view, document)) timer = view.setInterval(check, RECHECK_MS);
  };
  for (const type of FONT_SET_EVENTS) fonts.addEventListener(type, check);
  document.addEventListener("visibilitychange", followVisibility);
  followVisibility();
  return {
    watchers,
    check,
    stop: () => {
      for (const type of FONT_SET_EVENTS) fonts.removeEventListener(type, check);
      document.removeEventListener("visibilitychange", followVisibility);
      pause();
    },
  };
}

/**
 * Calls `onChange` when a check of the fonts of `node`'s document finds other faces, or one in
 * another status, than the last check found. `onChange` runs from an event, a promise reaction
 * or a timer, so a caller that measures layout requests its own animation frame from it.
 *
 * @param node - A node in the document to watch, which may be a same-origin frame's.
 * @param onChange - Called when a check finds a change.
 * @returns A function that stops the watch. The document's watch, with its listeners and its
 *   timer, stops with its last watcher. A second call does nothing.
 */
export function watchFontSet(node: Node, onChange: () => void): () => void {
  const view = windowOf(node);
  const { document } = view;
  const record = records.get(document) ?? { followed: new WeakSet<FontFace>(), active: null };
  records.set(document, record);
  const watch = record.active ?? startWatch(view, document, record);
  record.active = watch;
  watch.watchers.add(onChange);
  return () => {
    watch.watchers.delete(onChange);
    if (watch.watchers.size > 0 || record.active !== watch) return;
    record.active = null;
    watch.stop();
  };
}
