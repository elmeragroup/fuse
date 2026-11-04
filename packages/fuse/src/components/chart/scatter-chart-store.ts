"use client";

/**
 * A scatter Root's external store for state that changes at pointer or key rate: the active point,
 * who moved it, the series focus, the pin, a dismissal and the status message. Marks never
 * subscribe to it. Root writes the active point onto its own element and the active dot follows it
 * outside React, and only the parts that print the active point read it through a selector, so a
 * pointer move over one point commits nothing.
 */
import { useSyncExternalStore } from "react";

import type { DrawGate } from "./chart-draw-gate";
import { createDrawGate } from "./chart-draw-gate";
import { carryWalk } from "./layout/scatter-model";
import type { ScatterModel } from "./layout/scatter-model";

/** Who moved the active point. */
export type ScatterSource = "pointer" | "keyboard";

/**
 * The pointer and key rate state. Every point is an id in `model`, the model the store last
 * carried its state into, and a reader in a later model's render carries it through `carryWalk`.
 */
export type ScatterSnapshot = {
  /** Where Root's entrance is, which `chart-entrance.ts` moves on. */
  readonly phase: "waiting" | "started";
  /** The model the snapshot's ids belong to. */
  readonly model: ScatterModel;
  /** The active point's id, or null when nothing shows. */
  readonly active: number | null;
  /** The point the plot's option names, the keyboard's place, or null for an empty model. */
  readonly place: number | null;
  readonly source: ScatterSource | null;
  /** The focused series' index in config order, or -1 for all series. */
  readonly focus: number;
  /** Whether the tooltip and the active dot are pinned. */
  readonly pinned: boolean;
  /**
   * The point whose tooltip a dismissal closed, which a pointer over the same point does not
   * reopen, or null. Showing any point clears it, and a pointer that leaves the plot or a new touch
   * ends it.
   */
  readonly dismissed: number | null;
  /** The latest status message, with a counter so a repeat announces again. */
  readonly announcement: { readonly text: string; readonly count: number };
  /**
   * The kind of pointer the reader last used over the plot or its popup, or null before any. It
   * changes with the pointer, whether or not the active point does, so the popup lets taps through
   * from the first touch.
   */
  readonly input: string | null;
};

/** The pointer's last position over the plot and its type, in client pixels. */
export type TrackedPointer = { readonly x: number; readonly y: number; readonly type: string };

/**
 * The store one scatter Root owns. Every write is a named transition that reads the snapshot at
 * write time, carries it into the caller's model first and sets only the fields it owns, so no
 * caller spreads a snapshot it read earlier or holds a point id across a model change. SPEC.md's
 * transition table names each transition's fields.
 */
export type ScatterStore = {
  /** The state the store started with, which the server and a hydrating part read. */
  readonly initial: ScatterSnapshot;
  readonly get: () => ScatterSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  /** Whether the plot's parts may draw. */
  readonly drawing: DrawGate;
  /** The pointer's last position over the plot and its type. It is no state and notifies no one. */
  readonly pointer: () => TrackedPointer | null;
  /** The entrance's transition, which `chart-entrance.ts` runs. It owns `phase`. */
  readonly set: (patch: { readonly phase: ScatterSnapshot["phase"] }) => void;
  /**
   * Carry the walk into a new model, which Root runs after a data update. When the active point
   * has no counterpart there, nothing shows, so the pin and the source go with it.
   */
  readonly carry: (model: ScatterModel) => void;
  /**
   * A pointer over a point, or over none for -1. A pin holds, a point whose tooltip was dismissed
   * stays closed, and another point ends the dismissal. Over none, only the pointer's own point
   * clears.
   */
  readonly hover: (model: ScatterModel, point: number) => void;
  /** The pointer left the plot: its own unpinned point clears, and so does a dismissal. */
  readonly leave: () => void;
  /** A keyboard step to a place and a series focus, which the point there takes. */
  readonly step: (model: ScatterModel, place: number, focus: number) => void;
  /** Focus entered the plot: the place's point shows. */
  readonly enter: (model: ScatterModel) => void;
  /** Enter or Space: the place's point shows, pinned, or unpinned when it was. */
  readonly togglePin: (model: ScatterModel) => void;
  /**
   * A tap or a click on a point pins it. On the pinned point, or on none for -1, it takes the one
   * dismissal.
   */
  readonly press: (model: ScatterModel, point: number) => void;
  /**
   * The one dismissal: an outside press, a second tap on the pinned point, Escape and Base UI's own
   * dismissal all close the tooltip and unpin it at once, and the point stays closed under the
   * pointer.
   */
  readonly dismiss: (model: ScatterModel) => void;
  /** Focus left the plot: a keyboard or pinned point clears. */
  readonly release: () => void;
  /** A new touch ends a dismissal, so a third tap on a point opens it again. */
  readonly reopen: () => void;
  /** Record the pointer's position and type. It owns `input`, which it writes when the type changes. */
  readonly track: (x: number, y: number, type: string) => void;
  readonly announce: (text: string) => void;
};

/**
 * Create a scatter Root's store.
 *
 * @param model - The model Root first renders, whose first walk point the option names.
 * @returns The store.
 */
export function createScatterStore(model: ScatterModel): ScatterStore {
  const initial: ScatterSnapshot = {
    phase: "waiting",
    model,
    active: null,
    place: model.empty ? null : (model.order[0] ?? null),
    source: null,
    focus: -1,
    pinned: false,
    dismissed: null,
    announcement: { text: "", count: 0 },
    input: null,
  };
  let state = initial;
  let last: TrackedPointer | null = null;
  const listeners = new Set<() => void>();
  const write = (next: ScatterSnapshot): void => {
    // Every field counts, so no change of the model, the place or a later field is dropped.
    // SAFETY: Object.keys of a snapshot yields its own fields.
    const fields = Object.keys(next) as (keyof ScatterSnapshot)[];
    if (fields.every((field) => Object.is(next[field], state[field]))) return;
    state = next;
    for (const listener of listeners) listener();
  };
  /** The current snapshot in a model's ids, through the carry transition. */
  const carried = (to: ScatterModel): ScatterSnapshot => {
    if (state.model === to) return state;
    const walk = carryWalk(state.model, to, state);
    const lost = walk.active === null;
    return {
      ...state,
      ...walk,
      model: to,
      source: lost ? null : state.source,
      pinned: lost ? false : state.pinned,
    };
  };
  const shown = (now: ScatterSnapshot, active: number, source: ScatterSource): ScatterSnapshot => ({
    ...now,
    active,
    source,
    dismissed: null,
  });
  const dismissed = (now: ScatterSnapshot): ScatterSnapshot =>
    now.active === null && !now.pinned
      ? now
      : { ...now, active: null, source: null, pinned: false, dismissed: now.active };
  const store: ScatterStore = {
    initial,
    drawing: createDrawGate(),
    pointer: () => last,
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set({ phase }) {
      write({ ...state, phase });
    },
    carry(to) {
      write(carried(to));
    },
    hover(to, point) {
      const now = carried(to);
      if (now.pinned) write(now);
      else if (point === -1) write(now.source === "pointer" ? { ...now, active: null, source: null } : now);
      else if (point === now.dismissed) write(now);
      else write(shown(now, point, "pointer"));
    },
    leave() {
      const cleared = state.source === "pointer" && !state.pinned;
      write({
        ...state,
        active: cleared ? null : state.active,
        source: cleared ? null : state.source,
        dismissed: null,
      });
    },
    step(to, place, focus) {
      write({ ...shown(carried(to), place, "keyboard"), place, focus });
    },
    enter(to) {
      const now = carried(to);
      write(now.place === null ? now : shown(now, now.place, "keyboard"));
    },
    togglePin(to) {
      const now = carried(to);
      write(now.place === null ? now : { ...shown(now, now.place, "keyboard"), pinned: !now.pinned });
    },
    press(to, point) {
      const now = carried(to);
      if (point === -1 || (now.pinned && now.active === point)) write(dismissed(now));
      else write({ ...shown(now, point, "pointer"), pinned: true });
    },
    dismiss(to) {
      write(dismissed(carried(to)));
    },
    release() {
      if (state.source === "keyboard" || state.pinned) {
        write({ ...state, active: null, source: null, pinned: false });
      }
    },
    reopen() {
      write({ ...state, dismissed: null });
    },
    track(x, y, type) {
      last = { x, y, type };
      write({ ...state, input: type });
    },
    announce(text) {
      write({ ...state, announcement: { text, count: state.announcement.count + 1 } });
    },
  };
  return store;
}

/**
 * Read one value of the store. The server and hydration snapshot reads the initial state.
 *
 * @param store - The Root's store.
 * @param select - Picks the value. Return a primitive, so equal values skip the render.
 * @returns The selected value.
 */
export function useScatterStore<T>(store: ScatterStore, select: (snapshot: ScatterSnapshot) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.initial)
  );
}
