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
import { windowOf, windowShowing } from "../../internal/dom-node";

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

/** Starts the watch of `document` with no watchers yet. */
function startWatch(document: Document, record: FontSetRecord): FontSetWatch {
  const { fonts } = document;
  const watchers = new Set<() => void>();
  let seen = snapshotOf(fonts, record);
  const check = (): void => {
    if (windowShowing(document) === null || !changedSince(fonts, seen)) return;
    seen = snapshotOf(fonts, record);
    for (const watcher of [...watchers]) watcher();
  };
  let stopped = false;
  // The pending timeout. Once the window shows another document, the watch skips the clear. When a
  // same-origin document takes over the frame's initial about:blank, Chromium still runs the
  // timeout and WebKit drops it. Stopping sets `pending` to `null`, so a timeout that runs after
  // that does nothing.
  let pending: { readonly id: number } | null = null;
  const arm = (): void => {
    const view = windowShowing(document);
    if (stopped || pending !== null || view === null) return;
    const timeout = {
      id: view.setTimeout(() => {
        if (pending !== timeout) return;
        pending = null;
        check();
        arm();
      }, RECHECK_MS),
    };
    pending = timeout;
  };
  const pause = (): void => {
    // A navigated frame's timers reuse ids, so clearing this one there could clear one of theirs.
    if (pending !== null) windowShowing(document)?.clearTimeout(pending.id);
    pending = null;
  };
  const followVisibility = (): void => {
    if (document.visibilityState !== "visible") {
      pause();
      return;
    }
    check();
    arm();
  };
  for (const type of FONT_SET_EVENTS) fonts.addEventListener(type, check);
  document.addEventListener("visibilitychange", followVisibility);
  followVisibility();
  return {
    watchers,
    check,
    stop: () => {
      stopped = true;
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
  const { document } = windowOf(node);
  const record = records.get(document) ?? { followed: new WeakSet<FontFace>(), active: null };
  records.set(document, record);
  const watch = record.active ?? startWatch(document, record);
  record.active = watch;
  watch.watchers.add(onChange);
  return () => {
    watch.watchers.delete(onChange);
    if (watch.watchers.size > 0 || record.active !== watch) return;
    record.active = null;
    watch.stop();
  };
}
