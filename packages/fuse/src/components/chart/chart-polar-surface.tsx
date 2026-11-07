"use client";

/**
 * The polar plot surface: the listbox of `chart-listbox.tsx` over a polar Root's cell, whose option
 * names the active slice, ring or spoke, and the cell's one pointer target, which picks by angle,
 * by radius band or by nearest spoke through the family's model. CONTRACT section 9.4 gives the
 * maps: a pie's arrows wrap, a radial chart's rings do not, and a radar's Left and Right move
 * between spokes while Up and Down move the series focus. Home and End go to the first and last
 * option. PageUp and PageDown propagate, except on a clock, where they move one label unit.
 */
import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactElement } from "react";

import { listboxProps, SurfaceName, useGestureEnd, useOptionHandoff } from "./chart-listbox";
import { PolarContext } from "./chart-polar-context";
import type { PolarModel } from "./chart-polar-context";
import { ChartSelectionContext } from "./chart-readout-port";
import type { ClientPoint, PointerSlot } from "./chart-readout-port";
import { useChartStore } from "./chart-store";
import { useTapLift } from "./chart-tap-lift";
import type { OptionOrder } from "./chart-text";
import { corridorOf } from "./chart-tooltip-corridor";
import { sweepBox } from "./layout/polar-angle";

/** What one option names: the active option and the series focus. */
type OptionState = {
  readonly index: number;
  /** The focused series by config order, or -1 for all series. */
  readonly focus: number;
  readonly order: OptionOrder;
};

/** The option move a key makes, or undefined for a key the map leaves alone. */
type Step = "next" | "previous" | "first" | "last";

/** The option move a key makes in a family's map. */
/** How long, in milliseconds, a mouse that left the dial keeps its option before it lets go. */
const LEAVE_GRACE_MS = 120;

/** How long, in milliseconds, a pointer's near series holds after it changes. */
const NEAR_FIRM_MS = 150;

function stepOf(model: PolarModel, key: string): Step | undefined {
  switch (key) {
    case "ArrowRight":
      return "next";
    case "ArrowLeft":
      return "previous";
    case "ArrowDown":
      return model.series > 0 ? undefined : "next";
    case "ArrowUp":
      return model.series > 0 ? undefined : "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
}

/** The option a step reaches from `index`, wrapping where the family wraps. */
function stepped(model: PolarModel, index: number, step: Step): number {
  const last = model.count - 1;
  switch (step) {
    case "first":
      return 0;
    case "last":
      return last;
    case "next":
      return index >= last ? (model.wrap ? 0 : last) : index + 1;
    case "previous":
      return index <= 0 ? (model.wrap ? last : 0) : index - 1;
  }
}

/** A touch or pen press in progress: whether a tooltip was pinned, and the option it landed on. */
type Gesture = { readonly pinned: boolean; readonly index: number | null };

/**
 * The plot's single tab stop over a polar cell. A pointer picks the option under it by arithmetic
 * and never moves focus or changes the option.
 *
 * @returns The listbox, or null while nothing draws.
 */
export function PolarSurface(): ReactElement | null {
  const polar = use(PolarContext);
  if (polar === null) throw new Error("PolarSurface renders inside a polar Root, which always provides it.");
  const { model, kernel, labelledBy } = polar;
  const { store, id, locale, name } = kernel;
  const selectedKey = use(ChartSelectionContext);
  const listbox = useRef<HTMLDivElement>(null);
  const handoff = useOptionHandoff<OptionState>(id, listbox, () => ({
    index: Math.max(0, Math.min(model.count - 1, store.initial.active ?? 0)),
    focus: -1,
    order: "slot-first",
  }));
  const gesture = useRef<Gesture | null>(null);
  const lift = useTapLift();
  const pinned = useChartStore(store, (snapshot) => snapshot.pinned);
  // The slots a clock's Columns emphasise, whose options append the emphasis word.
  const emphasis = useChartStore(store, (snapshot) => snapshot.emphasis);
  const pick = kernel.usePick();
  // A mouse that leaves the dial gives up its option a moment later, unless it comes back first, so a
  // pointer that grazes the edge or crosses the label band and returns keeps a steady readout.
  const leaving = useRef<number | null>(null);
  const stayed = (): void => {
    if (leaving.current !== null) window.clearTimeout(leaving.current);
    leaving.current = null;
  };
  const leaveSoon = (): void => {
    stayed();
    leaving.current = window.setTimeout(() => {
      leaving.current = null;
      const snapshot = store.get();
      if (snapshot.source === "pointer" && !snapshot.pinned)
        store.set({ active: null, source: null, near: null });
    }, LEAVE_GRACE_MS);
  };
  useEffect(() => stayed, []);
  // When the near series last changed, which holds it for a moment, so a fast pointer that crosses
  // three series never flickers the dims.
  const nearSince = useRef(Number.NEGATIVE_INFINITY);
  // Where the pointer last stood on the active part, the corner a move toward the popup leaves from.
  const apex = useRef<ClientPoint | null>(null);
  // The watch that follows a pointer across the gap between the plot and the popup, while it runs.
  const crossing = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      crossing.current?.();
    },
    []
  );
  // New data keeps the option on its index while it exists, and the series focus while the series does.
  const [seen, setSeen] = useState(model);
  if (seen !== model) {
    setSeen(model);
    const latest = handoff.current;
    if (latest !== undefined && model.count > 0) {
      const index = Math.min(latest.index, model.count - 1);
      const focus = latest.focus < model.series ? latest.focus : -1;
      if (index !== latest.index || focus !== latest.focus)
        handoff.revise({ index, focus, order: latest.order });
    }
  }
  useLayoutEffect(() => {
    // The store's series focus follows the reconciled option while the keyboard drives it.
    const latest = handoff.options.at(-1);
    const snapshot = store.get();
    if (latest === undefined || snapshot.source !== "keyboard") return;
    const near = latest.focus === -1 ? null : latest.focus;
    if (snapshot.near !== near) store.set({ near });
  }, [handoff.options, store]);
  useGestureEnd(!model.empty && model.count > 0, lift, gesture, null);

  const current = handoff.current;
  if (model.empty || model.count === 0 || current === undefined) return null;

  const move = (patch: Partial<OptionState>): void => {
    const next: OptionState = { index: current.index, focus: current.focus, order: current.order, ...patch };
    handoff.step(next);
    store.set({ active: next.index, source: "keyboard", near: next.focus === -1 ? null : next.focus });
  };

  /** A press on an option: it selects under a LegendToggleGroup, and otherwise toggles the pin. */
  const press = (index: number, focus: number, reason: "plot" | "keyboard", event: Event): void => {
    const key = model.selectKey(index, focus);
    // Under a LegendToggleGroup a press selects, and a radar's "all series" focus clears. Other names
    // no config key, so a press on it toggles the pin as it would with no group mounted.
    if (kernel.hasToggles() && (key !== null || (model.series > 0 && focus === -1))) {
      kernel.select(key === selectedKey ? null : key, reason, event);
      return;
    }
    const snapshot = store.get();
    if (snapshot.pinned && snapshot.active === index) store.dismiss();
    else store.set({ active: index, source: reason === "plot" ? "pointer" : "keyboard", pinned: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "option") return;
    const step = stepOf(model, event.key);
    const focusStep =
      model.series > 0 ? (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0) : 0;
    const page = event.key === "PageDown" ? 1 : event.key === "PageUp" ? -1 : 0;
    if (step !== undefined) {
      move({ index: stepped(model, current.index, step), order: "slot-first" });
    } else if (page !== 0 && model.page !== null) {
      move({ index: model.page(current.index, page), order: "slot-first" });
    } else if (focusStep !== 0) {
      const focus = Math.max(-1, Math.min(model.series - 1, current.focus + focusStep));
      if (model.series > 1 && focus !== current.focus) move({ focus, order: "series-first" });
    } else if (event.key === "Enter" || event.key === " ") {
      press(current.index, current.focus, "keyboard", event.nativeEvent);
    } else if (event.key === "Escape") {
      const snapshot = store.get();
      if (snapshot.active === null && !snapshot.pinned) return;
      store.dismiss();
      event.stopPropagation();
    } else {
      return;
    }
    event.preventDefault();
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event)) {
      handoff.prune();
      return;
    }
    if (lift.tapFocus() || gesture.current !== null) return;
    store.set({
      active: current.index,
      source: "keyboard",
      near: current.focus === -1 ? null : current.focus,
    });
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event) || handoff.kept(event)) return;
    const tapped = lift.tapFocus() || gesture.current !== null;
    if (!tapped && (store.get().source === "keyboard" || store.get().pinned)) {
      store.set({ active: null, source: null, near: null, pinned: false });
    }
    handoff.reset({ index: current.index, focus: current.focus, order: "slot-first" });
  };

  /**
   * The option and series under a pointer, or null where nothing picks. A pointer that holds an
   * option keeps it across the pick's 2 px dead band, and keeps its series unless another is clearly
   * nearer.
   */
  const pickAt = (event: MouseEvent<HTMLDivElement>): PointerSlot | null => {
    const { active, near, source } = store.get();
    const firm = event.timeStamp - nearSince.current < NEAR_FIRM_MS;
    const held = source === "pointer" && active !== null ? { slot: active, near, firm } : null;
    const found = pick(event.clientX, event.clientY, held);
    if (found !== null && found.near !== near) nearSince.current = event.timeStamp;
    return found;
  };

  /** Whether a client point lies on the dial, within its outer radius of its centre. */
  const insideDial = (point: ClientPoint): boolean => {
    const rect = listbox.current?.getBoundingClientRect();
    const box = sweepBox(model.sweep);
    const width = box.right - box.left;
    if (rect === undefined || !(rect.width > 0) || !(width > 0)) return false;
    const scale = rect.width / width;
    const x = box.left + (point.x - rect.left) / scale;
    const y = box.top + (point.y - rect.top) / scale;
    return Math.hypot(x, y) <= 1;
  };

  /**
   * Whether a pointer at a point heads for the open popup from the active part: past the rim, inside
   * the triangle from where it last stood on that part to the popup's near edge (CONTRACT section
   * 9.5). Inside the dial the pick always wins, so the triangle never holds a part the pointer
   * has left.
   */
  const heading = (to: ClientPoint): boolean => {
    const from = apex.current;
    const corridor = corridorOf(store);
    if (from === null || corridor === undefined || insideDial(to)) return false;
    return corridor(from, to);
  };

  /**
   * Follow a pointer that left the plot toward the popup across the gap between them, where no
   * plot event reaches it. It keeps the active part until the pointer reaches the popup or the plot
   * again, which take it from there, or leaves the corridor, which ends the hover.
   */
  const crossGap = (): void => {
    crossing.current?.();
    const surface = listbox.current;
    const move = (event: globalThis.PointerEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-slot="chart-tooltip"]') != null || (surface?.contains(target) ?? false)) {
        stop();
        return;
      }
      if (heading({ x: event.clientX, y: event.clientY })) return;
      stop();
      const snapshot = store.get();
      if (snapshot.source === "pointer" && !snapshot.pinned)
        store.set({ active: null, source: null, near: null });
    };
    const stop = (): void => {
      document.removeEventListener("pointermove", move, true);
      crossing.current = null;
    };
    document.addEventListener("pointermove", move, true);
    crossing.current = stop;
  };

  const hover = (event: PointerEvent<HTMLDivElement>): void => {
    crossing.current?.();
    stayed();
    store.track(event.clientX, event.clientY, event.pointerType, event.timeStamp);
    const { pinned: isPinned, dismissed, active, source } = store.get();
    if (isPinned) return;
    const point = { x: event.clientX, y: event.clientY };
    const found = pickAt(event);
    // A pointer heading for the open popup keeps the part it left, over the parts it crosses.
    if (active !== null && source === "pointer" && found?.slot !== active && heading(point)) return;
    if (found === null) {
      apex.current = null;
      if (source === "pointer") store.set({ active: null, source: null, near: null });
      return;
    }
    // A dismissed tooltip stays closed while the pointer stays on its option.
    if (dismissed === found.slot) return;
    apex.current = point;
    store.set({ active: found.slot, source: "pointer", near: found.near });
  };

  const naming = { id, name, labelledBy, locale };
  const label = model.optionName(current.index, current.focus, current.order, emphasis);
  return (
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the active option holds the one tab stop
    <div
      ref={listbox}
      role="listbox"
      {...listboxProps(naming, pinned, model.orientation)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerMove={hover}
      onMouseDown={() => {
        lift.mouseDown();
      }}
      onPointerDown={(event) => {
        lift.press();
        if (event.pointerType === "mouse") return;
        const snapshot = store.get();
        gesture.current = { pinned: snapshot.pinned, index: pickAt(event)?.slot ?? null };
        if (snapshot.dismissed !== null) store.set({ dismissed: null });
        hover(event);
      }}
      onPointerUp={(event) => {
        const started = gesture.current;
        gesture.current = null;
        if (event.pointerType === "mouse" || started === null) return;
        const index = started.pinned ? started.index : store.get().active;
        if (index === null) return;
        lift.lift();
        press(index, store.get().near ?? -1, "plot", event.nativeEvent);
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      onPointerLeave={(event) => {
        const intoPopup =
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest('[data-slot="chart-tooltip"]') !== null;
        if (intoPopup || event.pointerType !== "mouse") return;
        const snapshot = store.get();
        // A pointer that leaves toward the popup keeps the part across the gap to it.
        if (snapshot.source === "pointer" && !snapshot.pinned) {
          if (heading({ x: event.clientX, y: event.clientY })) crossGap();
          else leaveSoon();
        }
        if (snapshot.dismissed !== null) store.set({ dismissed: null });
      }}
      onClick={(event) => {
        if (!lift.clickActs(event)) return;
        if (event.detail === 0) {
          const { active } = store.get();
          if (active !== null) press(active, current.focus, "keyboard", event.nativeEvent);
          return;
        }
        const found = pickAt(event);
        if (found !== null) press(found.slot, found.near ?? -1, "plot", event.nativeEvent);
      }}>
      <SurfaceName {...naming} />
      {handoff.options.map((option) => (
        <div
          key={option.id}
          id={option.id}
          // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- the legend owns selection, so options mark none
          role="option"
          data-slot="chart-point"
          data-focus-ring-control=""
          tabIndex={option === current ? 0 : -1}
          aria-label={
            option === current ? label : model.optionName(option.index, option.focus, option.order, emphasis)
          }
          aria-posinset={option.index + 1}
          aria-setsize={model.count}
          aria-describedby={option.entry ? `${id}-description ${id}-instructions` : undefined}
        />
      ))}
    </div>
  );
}

Object.assign(PolarSurface, { displayName: "PolarChart.Root.Surface" });
