"use client";

/**
 * Root's external store for state that changes at pointer or key rate. Marks never subscribe to
 * it. Root writes the active slot onto its own element and hands it to the followers of
 * `chart-followers.ts`, and only the parts that print the active point read it through a selector,
 * so a pointer move inside one slot commits nothing.
 *
 * The store also holds the phase of Root's entrance, which `chart-entrance.ts` moves on. A mark
 * reads it through `usePhase` as it draws, so a mark that draws while the entrance waits joins it,
 * and one that draws after it started snaps or fades in. The server and hydration snapshot is
 * `"waiting"`, so a hydrating mark matches the server HTML wherever its Suspense boundary resolves.
 */
import { useState, useSyncExternalStore } from "react";

import { createDrawGate, subscribeNever } from "./chart-draw-gate";
import type { DrawGate } from "./chart-draw-gate";
import { trackPointer } from "./layout/pointer-speed";
import type { TrackedPointer } from "./layout/pointer-speed";

/**
 * Where Root's entrance is. It is `"waiting"` until the entrance starts, or until Root first
 * commits when it has none, and `"started"` from then on.
 */
export type EntrancePhase = "waiting" | "started";

/**
 * What a mark writes on `data-intro`, from the phase it first draws in. While the entrance waits it
 * writes nothing, so the entrance animates it, and "none" when Root has no entrance. A mark that
 * draws after the entrance started writes "fade" in a data update and "none" in any other commit.
 *
 * @param phase - The phase the mark first drew in.
 * @param kind - The commit that mounted it.
 * @param entrance - Whether Root has an entrance, which Root's CSS or the loop, as a bar's grows,
 *   runs.
 * @returns The attribute's value, or undefined to write none.
 */
export function introFor(
  phase: EntrancePhase,
  kind: "initial" | "data" | "range",
  entrance: boolean
): "fade" | "none" | undefined {
  if (phase === "waiting") return entrance ? undefined : "none";
  return kind === "data" ? "fade" : "none";
}

/** Who moved the active slot. */
export type ActiveSource = "pointer" | "keyboard" | "default";

/** The slots one Bar emphasizes, with the word its option appends. */
export type EmphasisEntry = { readonly slots: readonly number[]; readonly label: string | undefined };

/** The pointer and key rate state. */
export type ChartSnapshot = {
  readonly phase: EntrancePhase;
  /** The active slot, or null when nothing shows. */
  readonly active: number | null;
  readonly source: ActiveSource | null;
  /**
   * Whether a default slot may still turn active. It holds while the store started with nothing
   * active and no write has changed `source` since. A reader's pointer, key or dismissal changes
   * `source`, and so does Root when it makes the default active. Root's own writes for new data
   * leave it alone. The store derives it, so no write sets it, and `defaultApplies` reads it.
   */
  readonly defaultPending: boolean;
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
   * The emphasized slots each Bar registered after it mounted, by config key. The server and a
   * hydrating option hold none, and the word arrives in the update that registration triggers.
   */
  readonly emphasis: { readonly [key: string]: EmphasisEntry };
  /**
   * The kind of pointer the user last used over the plot, or `null` before any. `track` writes it
   * whenever it changes, whether or not the active slot does. So the popup lets taps through to the
   * plot from the first touch, even one on the slot a mouse already shows.
   */
  readonly input: string | null;
};

/** A write to the store. The store derives `defaultPending` itself. */
export type ChartPatch = Partial<Omit<ChartSnapshot, "defaultPending">>;

/** The store of one Root. */
export type ChartStore = {
  /** The state the store started with, which the server and a hydrating part read. */
  readonly initial: ChartSnapshot;
  readonly get: () => ChartSnapshot;
  readonly set: (patch: ChartPatch) => void;
  /**
   * How many writes have named `active`, counted whether or not they changed it. A Root compares
   * the count across a commit to tell an active slot written for the new model, as a focus from a
   * ref or a child's layout effect writes it, from one written for the model before.
   */
  readonly activeWrites: () => number;
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
  /**
   * Records the pointer's position over the plot at an event's time stamp, which `pointer` returns
   * with the speed of its recent moves. It writes `input` when the type changes.
   */
  readonly track: (x: number, y: number, type: string, time: number) => void;
  /** Whether the plot's parts may draw, which `openDrawing` sets once. */
  readonly drawing: DrawGate;
};

const INITIAL: ChartSnapshot = {
  phase: "waiting",
  active: null,
  source: null,
  defaultPending: true,
  near: null,
  pinned: false,
  dismissed: null,
  frozen: false,
  announcement: { text: "", count: 0 },
  emphasis: {},
  input: null,
};

/**
 * Creates a Root's store.
 *
 * @param defaultActive - The slot active before any pointer or key moves, from `defaultActiveX`.
 * @returns The store.
 */
export function createChartStore(defaultActive: number | null = null): ChartStore {
  const initial: ChartSnapshot =
    defaultActive === null
      ? INITIAL
      : { ...INITIAL, active: defaultActive, source: "default", defaultPending: false };
  let state = initial;
  let activeWrites = 0;
  const listeners = new Set<() => void>();
  // SAFETY: `Object.keys` reads a literal object that has exactly the `ChartSnapshot` fields.
  const keys = Object.keys(INITIAL) as (keyof ChartSnapshot)[];
  let last: TrackedPointer | null = null;
  return {
    initial,
    activeWrites: () => activeWrites,
    drawing: createDrawGate(),
    pointer: () => last,
    track(x, y, type, time) {
      last = trackPointer(last, x, y, type, time);
      if (type !== state.input) this.set({ input: type });
    },
    get: () => state,
    set(patch) {
      // A keyboard step or another slot reopens a dismissed tooltip.
      const reopened =
        patch.source === "keyboard" ||
        (patch.active !== undefined && patch.active !== null && patch.active !== state.dismissed);
      if (patch.active !== undefined) activeWrites += 1;
      const source = patch.source !== undefined ? patch.source : state.source;
      const next: ChartSnapshot = {
        ...state,
        ...patch,
        defaultPending: state.defaultPending && source === state.source,
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

/** The active slot, series and source a Root last painted, which its store subscriber compares. */
export type PaintedStep = readonly [
  active: number | null,
  near: number | null,
  source: ChartSnapshot["source"],
];

/**
 * Whether a Root's default slot should be the active one in a new model that holds it. The default
 * applies while it is pending, and with `follow`, also while it is active. A cartesian Root keeps
 * its active slot by x, so it needs no `follow`. A polar Root keeps its active option by index, and
 * `follow` keeps the default on its item when new data moves the item's index.
 *
 * A surface selects this boolean through `useChartStore` and finds the slot in its model after.
 * Selecting the slot would hide a reader's move from React: while the committed model lacks the
 * default, the slot reads null before and after the move, so a render held for a new model that
 * holds it would commit the stale default.
 *
 * @param snapshot - The Root's store state.
 * @param follow - Whether an active default follows its item into each new model.
 * @returns Whether the default applies.
 */
export function defaultApplies(snapshot: ChartSnapshot, follow: "follow" | "pending"): boolean {
  return snapshot.defaultPending || (follow === "follow" && snapshot.source === "default");
}

/**
 * Makes a Root's default slot active while `defaultApplies` holds and the model holds the slot.
 * Each Root finds the slot in its own model and calls this from its model effect. It records the step as painted before the
 * write notifies the store's subscribers. Root's subscriber then paints no reader step for it,
 * which would glide the followers as a pointer does, and Root paints the slot as part of the
 * commit right after.
 *
 * @param store - The Root's store.
 * @param painted - The Root's last painted step.
 * @param slot - The default slot in the current model, or null while the model does not hold it.
 * @param follow - Whether an active default follows its item into each new model.
 */
export function applyDefault(
  store: ChartStore,
  painted: { current: PaintedStep },
  slot: number | null,
  follow: "follow" | "pending"
): void {
  if (slot === null || !defaultApplies(store.get(), follow)) return;
  painted.current = [slot, store.get().near, "default"];
  store.set({ active: slot, source: "default" });
}

/**
 * Reads one value of the store. The server and hydration snapshot reads the initial state.
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
 * What a mark's intro reads of its Root's store: the phase now and the phase the server and a
 * hydrating mark read. Chart's and ScatterChart's stores both hold it.
 */
export type PhaseSource = {
  readonly initial: { readonly phase: EntrancePhase };
  readonly get: () => { readonly phase: EntrancePhase };
};

/**
 * Root's entrance phase as a mark draws now. Root moves it outside any render, and no mark renders
 * again for it, so a mark reads where the entrance is in each render it draws in. Hydration reads
 * `"waiting"`, as the server did.
 *
 * @param store - The Root's store.
 * @returns The phase.
 */
export function usePhase(store: PhaseSource): EntrancePhase {
  return useSyncExternalStore(
    subscribeNever,
    () => store.get().phase,
    () => store.initial.phase
  );
}

/**
 * What a mark writes on `data-intro` for its life, by the one rule every mark follows. While it
 * hydrates it matches the server, which read the entrance waiting. In the first render it draws in
 * it keeps what `introFor` says from Root's live phase, so a mark that draws while the entrance
 * waits joins it, and one that first draws after the entrance started, as a series whose Suspense
 * boundary hydrates late, takes its place at once. A bar or a dot mounts only once it draws, so
 * it keeps the value of its first render, which is the same rule.
 *
 * @param store - The Root's store.
 * @param kind - The commit the mark renders in.
 * @param entrance - Whether Root has an entrance.
 * @param drawn - Whether the mark draws in this render, which a measured plot and an open draw gate
 *   allow.
 * @returns The attribute's value, or undefined to write none.
 */
export function useIntro(
  store: PhaseSource,
  kind: "initial" | "data" | "range",
  entrance: boolean,
  drawn: boolean
): "fade" | "none" | undefined {
  return useKeptIntro(introFor(usePhase(store), kind, entrance), drawn);
}

/**
 * The `data-intro` value of a mark's first drawn render, as `useIntro` keeps it, from the value
 * `introFor` gives the current render.
 *
 * @param live - What `introFor` says for this render.
 * @param drawn - Whether the mark draws in this render.
 * @returns The attribute's value, or undefined to write none.
 */
export function useKeptIntro(live: "fade" | "none" | undefined, drawn: boolean): "fade" | "none" | undefined {
  // Null until the mark first draws. Undefined is a value it can keep.
  const [kept, setKept] = useState<"fade" | "none" | undefined | null>(null);
  if (kept !== null) return kept;
  if (drawn) setKept(live);
  return live;
}
