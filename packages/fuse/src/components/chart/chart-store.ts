"use client";

/**
 * Root's external store for state that changes at pointer or key rate. Marks never subscribe to
 * it. Root writes the active slot onto its own element and hands it to the followers of
 * `chart-followers.ts`, and only the parts that print the active point read it through a selector,
 * so a pointer move inside one slot commits nothing.
 *
 * The store also holds the mount phase of ticket 05's E11. It is `"initial"` until Root's first
 * effect after the browser measures the plot sets it to `"mounted"`. A mark reads it through `useSyncExternalStore`, whose server and
 * hydration snapshot is `"initial"`, so a hydrating mark matches the server HTML wherever its
 * Suspense boundary resolves, and a mark that mounts later sees `"mounted"` and snaps.
 */
import { useState, useSyncExternalStore } from "react";

/** Whether Root has committed once. */
export type MountPhase = "initial" | "mounted";

/** Who moved the active slot. */
export type ActiveSource = "pointer" | "keyboard" | "default";

/** The slots one Bar emphasises, with the word its option appends. */
export type EmphasisEntry = { readonly slots: readonly number[]; readonly label: string | undefined };

/** The pointer and key rate state. */
export type ChartSnapshot = {
  readonly phase: MountPhase;
  /** The active slot, or null when nothing shows. */
  readonly active: number | null;
  readonly source: ActiveSource | null;
  /** The key nearest the pointer, or the focused key of the series cycle, by config order. */
  readonly near: number | null;
  /** Whether the tooltip and crosshair are pinned. */
  readonly pinned: boolean;
  /**
   * The slot whose tooltip a dismissal closed, which a pointer over the same slot does not reopen,
   * or null. A keyboard step or another slot clears it.
   */
  readonly dismissed: number | null;
  /** Whether the pointer is inside the tooltip popup, which freezes the active slot. */
  readonly frozen: boolean;
  /** The latest status message, with a counter so a repeat announces again. */
  readonly announcement: { readonly text: string; readonly count: number };
  /**
   * The emphasised slots each Bar registered after it mounted, by config key. The server and a
   * hydrating option hold none, and the word arrives in the update that registration triggers.
   */
  readonly emphasis: { readonly [key: string]: EmphasisEntry };
};

/** The pointer's last position over the plot, in client pixels, and its pointer type. */
export type TrackedPointer = { readonly x: number; readonly y: number; readonly type: string };

/** The store one Root owns. */
export type ChartStore = {
  /** The state the store started with, which the server and a hydrating part read. */
  readonly initial: ChartSnapshot;
  readonly get: () => ChartSnapshot;
  readonly set: (patch: Partial<ChartSnapshot>) => void;
  /**
   * The one dismissal transition: an outside press, a second tap on the pinned slot, Escape and
   * Base UI's own dismissal all close the tooltip, unpin it and hide the crosshair at once.
   */
  readonly dismiss: () => void;
  readonly announce: (text: string) => void;
  readonly subscribe: (listener: () => void) => () => void;
  /**
   * The pointer's last position over the plot, in client pixels. It is no state and notifies no
   * one. The tooltip reads it to tell a move toward its popup from a scrub across it.
   */
  readonly pointer: () => TrackedPointer | null;
  /** Record the pointer's position over the plot, which `pointer` returns. */
  readonly track: (x: number, y: number, type: string) => void;
};

const INITIAL: ChartSnapshot = {
  phase: "initial",
  active: null,
  source: null,
  near: null,
  pinned: false,
  dismissed: null,
  frozen: false,
  announcement: { text: "", count: 0 },
  emphasis: {},
};

/**
 * Create a Root's store.
 *
 * @param defaultActive - The slot active before any pointer or key moves, from `defaultActiveX`.
 * @returns The store.
 */
export function createChartStore(defaultActive: number | null = null): ChartStore {
  const initial: ChartSnapshot =
    defaultActive === null ? INITIAL : { ...INITIAL, active: defaultActive, source: "default" };
  let state = initial;
  const listeners = new Set<() => void>();
  // SAFETY: Object.keys of a literal object with exactly the ChartSnapshot fields.
  const keys = Object.keys(INITIAL) as (keyof ChartSnapshot)[];
  let last: TrackedPointer | null = null;
  return {
    initial,
    pointer: () => last,
    track(x, y, type) {
      last = { x, y, type };
    },
    get: () => state,
    set(patch) {
      // A keyboard step or another slot reopens a dismissed tooltip.
      const reopened =
        patch.source === "keyboard" ||
        (patch.active !== undefined && patch.active !== null && patch.active !== state.dismissed);
      const next: ChartSnapshot = {
        ...state,
        ...patch,
        dismissed: patch.dismissed !== undefined ? patch.dismissed : reopened ? null : state.dismissed,
      };
      if (keys.every((key) => Object.is(next[key], state[key]))) return;
      state = next;
      for (const listener of listeners) listener();
    },
    dismiss() {
      if (state.active === null && !state.pinned) return;
      this.set({
        active: null,
        source: null,
        near: null,
        pinned: false,
        frozen: false,
        dismissed: state.active,
      });
    },
    announce(text) {
      this.set({ announcement: { text, count: state.announcement.count + 1 } });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Read one value of the store. The server and hydration snapshot reads the initial state.
 *
 * @param store - The Root's store.
 * @param select - Picks the value. Return a primitive, so equal values skip the render.
 * @returns The selected value.
 */
export function useChartStore<T>(store: ChartStore, select: (snapshot: ChartSnapshot) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.initial)
  );
}

/**
 * The mount phase a mark saw on its first render. A mark that first rendered after Root's first
 * commit writes `data-intro="none"` and snaps into place.
 *
 * @param store - The Root's store.
 * @returns `"mounted"` for a mark that mounted late, else `"initial"`.
 */
export function useFirstPhase(store: ChartStore): MountPhase {
  // The subscription never fires, so a mark renders no second time when Root mounts. Hydration
  // still reads the server snapshot, and a later mount reads the store as it is then.
  const phase = useSyncExternalStore(
    subscribeNever,
    () => store.get().phase,
    () => store.initial.phase
  );
  const [first] = useState(phase);
  return first;
}

/**
 * Whether this part first rendered in a browser mount, as opposed to on the server or while it
 * hydrated server HTML. The server and hydration snapshot is `false`, and the first value stays,
 * so a hydrated chart never starts the entrance that only a client mount runs.
 *
 * @returns `true` for a part that mounted in the browser without server HTML.
 */
export function useClientMount(): boolean {
  const client = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const [first] = useState(client);
  return first;
}

/** A store subscription for a value a part reads once. */
function subscribeNever(): () => void {
  return () => undefined;
}
