"use client";

import { use, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactElement } from "react";

import { useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { listboxProps, StatusRegion, SurfaceName, useGestureEnd, useOptionHandoff } from "./chart-listbox";
import { pointerSlot } from "./chart-pick";
import { useRootFrame } from "./chart-plot";
import { ChartSelectionContext } from "./chart-readout-port";
import type { PointerSlot } from "./chart-readout-port";
import { useChartStore } from "./chart-store";
import { useTapLift } from "./chart-tap-lift";
import { optionName } from "./chart-text";
import type { OptionOrder } from "./chart-text";
import { optionBand } from "./layout/plot-frame";
import { keepSlot, stepSlot } from "./layout/slot-window";
import type { SlotStep, SlotWindow } from "./layout/slot-window";
import { slotX } from "./layout/x-domain";

/**
 * The cartesian plot surface: the listbox of `chart-listbox.tsx` over a cartesian Root, whose
 * options step through the window's slots and the series focus, and the plot's one pointer target,
 * which picks a slot by arithmetic.
 */

/**
 * A touch or pen press in progress: whether a tooltip was pinned, the slot it landed on, and
 * whether that slot's tooltip already showed under a LegendToggleGroup.
 */
type Gesture = { readonly pinned: boolean; readonly slot: number; readonly shown: boolean };

/** What one option names. Its x, not its index, survives a data update. */
type OptionState = {
  readonly x: string | Date;
  /** The focused series by config order, or -1 for all series. */
  readonly focus: number;
  readonly order: OptionOrder;
};

/**
 * The slot move a key makes. Arrow directions are physical, so time runs left to right under
 * `dir="rtl"` too, and horizontal bars list their categories top to bottom.
 */
function slotStepOf(orientation: "vertical" | "horizontal", key: string): SlotStep | undefined {
  switch (key) {
    case "ArrowRight":
      return orientation === "vertical" ? "next" : undefined;
    case "ArrowLeft":
      return orientation === "vertical" ? "previous" : undefined;
    case "ArrowDown":
      return orientation === "horizontal" ? "next" : undefined;
    case "ArrowUp":
      return orientation === "horizontal" ? "previous" : undefined;
    case "PageDown":
      return "page-next";
    case "PageUp":
      return "page-previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
}

/** The series-focus move a key makes, across the axis the slots run along. */
function seriesStepOf(orientation: "vertical" | "horizontal", key: string): 1 | -1 | undefined {
  if (orientation === "vertical") return key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : undefined;
  return key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : undefined;
}

/** Whether two slot x values name the same slot. */
function sameX(a: string | Date, b: string | Date): boolean {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}

/** The slot an option names in the current model, which keeps its x across data updates. */
function slotOfOption(
  context: ChartRootContextValue,
  window: SlotWindow,
  option: Pick<OptionState, "x">
): number {
  return keepSlot(context.model.domain, window, option.x);
}

/**
 * The plot's single tab stop, whose one option names the active slot. The surface is also the
 * plot's one pointer target. A pointer picks the slot by arithmetic and never moves focus or
 * changes the option.
 */
export function ChartSurface({
  name,
  labelledBy,
}: {
  readonly name: string | undefined;
  readonly labelledBy: string | undefined;
}): ReactElement | null {
  const context = useChartRoot("Chart.Root");
  const selectedKey = use(ChartSelectionContext);
  const { model, store, id, orientation, locale } = context;
  const window = model.window;
  const listbox = useRef<HTMLDivElement>(null);
  const handoff = useOptionHandoff<OptionState>(id, listbox, () => ({
    x: slotX(model.domain, store.initial.active ?? window?.first ?? 0),
    focus: -1,
    order: "slot-first",
  }));
  const { options } = handoff;
  /** Whether the current press started while a tooltip was pinned, which a touch lift reads. */
  const gesture = useRef<Gesture | null>(null);
  /** The touch or pen lift that just acted, so the focus that follows a tap keeps its slot. */
  const lift = useTapLift();
  const drawn = useRootFrame("Chart.Root");
  const pinned = useChartStore(store, (snapshot) => snapshot.pinned);
  const emphasis = useChartStore(store, (snapshot) => snapshot.emphasis);
  // One canonical active identity. When new data or a new window drops the option's slot, the
  // option takes the slot Root falls back to, as Root's store does, and a focused series that
  // leaves the config gives way to all series.
  const [seen, setSeen] = useState(() => ({ model, keys: model.series.map(({ key }) => key) }));
  if (seen.model !== model) {
    const keys = model.series.map(({ key }) => key);
    setSeen({ model, keys });
    const latest = handoff.current;
    if (latest !== undefined && model.window !== null) {
      const x = slotX(model.domain, keepSlot(model.domain, model.window, latest.x));
      const focusKey = latest.focus === -1 ? undefined : seen.keys[latest.focus];
      const focus = focusKey === undefined ? -1 : keys.indexOf(focusKey);
      if (!sameX(x, latest.x) || focus !== latest.focus) handoff.revise({ x, focus, order: latest.order });
    }
  }
  useLayoutEffect(() => {
    // The store's series focus follows the reconciled option while the keyboard drives it.
    const latest = options.at(-1);
    const snapshot = store.get();
    if (latest === undefined || snapshot.source !== "keyboard") return;
    const near = latest.focus === -1 ? null : latest.focus;
    if (snapshot.near !== near) store.set({ near });
  }, [options, store]);

  useGestureEnd(window !== null && !model.empty, lift, gesture, null);

  const current = handoff.current;
  if (window === null || model.empty || current === undefined) return null;
  const count = window.last - window.first + 1;
  const keys = model.series.length;

  const move = (patch: Partial<OptionState>): void => {
    const next: OptionState = { x: current.x, focus: current.focus, order: current.order, ...patch };
    handoff.step(next);
    store.set({
      active: slotOfOption(context, window, next),
      source: "keyboard",
      near: next.focus === -1 ? null : next.focus,
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "option") return;
    const slot = slotOfOption(context, window, current);
    const step = slotStepOf(orientation, event.key);
    const seriesStep = seriesStepOf(orientation, event.key);
    if (step !== undefined) {
      move({ x: slotX(model.domain, stepSlot(window, slot, step)), order: "slot-first" });
    } else if (seriesStep !== undefined) {
      const focus = Math.max(-1, Math.min(keys - 1, current.focus + seriesStep));
      if (keys > 1 && focus !== current.focus) move({ focus, order: "series-first" });
    } else if (event.key === "Enter" || event.key === " ") {
      if (context.hasToggles()) {
        // With a LegendToggleGroup mounted, Enter selects the focused series and clears it under "all series".
        const key = current.focus === -1 ? null : (model.series[current.focus]?.key ?? null);
        context.select(key === selectedKey ? null : key, "keyboard", event.nativeEvent);
      } else {
        store.set({ pinned: !store.get().pinned, active: slot, source: "keyboard" });
      }
    } else if (event.key === "Escape") {
      const snapshot = store.get();
      if (snapshot.active === null && !snapshot.pinned) return;
      // The one dismissal, which a pointer that stays on the slot does not undo.
      store.dismiss();
      event.stopPropagation();
    } else {
      return;
    }
    event.preventDefault();
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event)) {
      // The old option leaves in the commit after the new one took focus.
      handoff.prune();
      return;
    }
    // A tap focuses the option after its lift, at the point Chromium's touch adjustment moved it
    // to, which may be another slot's option. The slot the finger's own point picked stays active.
    if (lift.tapFocus() || gesture.current !== null) return;
    store.set({
      active: slotOfOption(context, window, current),
      source: "keyboard",
      near: current.focus === -1 ? null : current.focus,
    });
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event)) return;
    // A tap on the plot moves focus off an option that an earlier tap focused, and the slot it
    // pinned stays.
    const tapped = lift.tapFocus() || gesture.current !== null;
    if (!tapped && (store.get().source === "keyboard" || store.get().pinned)) {
      store.set({ active: null, source: null, near: null, pinned: false });
    }
    // The next entry meets a new option that carries the description again.
    handoff.reset({ x: current.x, focus: current.focus, order: "slot-first" });
  };

  /** The slot and the nearest series under a pointer, picked by arithmetic. */
  const slotAt = (event: MouseEvent<HTMLDivElement>): PointerSlot =>
    pointerSlot(
      context,
      drawn?.frame ?? null,
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY
    );

  const pick = (event: PointerEvent<HTMLDivElement>): void => {
    store.track(event.clientX, event.clientY, event.pointerType, event.timeStamp);
    const { pinned: isPinned, dismissed } = store.get();
    if (isPinned) return;
    const { slot, near } = slotAt(event);
    // A dismissed tooltip stays closed while the pointer stays on its slot.
    if (dismissed === slot) return;
    store.set({ active: slot, source: "pointer", near });
  };

  /**
   * A tap or a click on the plot. It pins the slot under the pointer, and on the pinned slot it
   * takes the one dismissal. Under a LegendToggleGroup it selects the nearest series instead.
   */
  const press = (
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
    slot: number,
    shown = false
  ): void => {
    const snapshot = store.get();
    // Under a LegendToggleGroup a touch reader selects through the toggles, so a second tap on
    // the slot whose tooltip shows dismisses it, as CONTRACT section 9.5's Touch rule says.
    if (shown) {
      store.dismiss();
      return;
    }
    if (context.hasToggles()) {
      const key = snapshot.near === null ? null : (model.series[snapshot.near]?.key ?? null);
      context.select(key === selectedKey ? null : key, "plot", event.nativeEvent);
      return;
    }
    if (snapshot.pinned && snapshot.active === slot) store.dismiss();
    else store.set({ active: slot, source: "pointer", pinned: true });
  };

  const naming = { id, name, labelledBy, locale };

  return (
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the active option holds the one tab stop
    <div
      ref={listbox}
      role="listbox"
      {...listboxProps(naming, pinned, orientation === "vertical" ? "horizontal" : "vertical")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerMove={pick}
      // The span the surface covers can trail a move no commit or resize reported, so a pointer
      // that arrives places it again first.
      onPointerEnter={() => context.placeSpan()}
      onMouseDown={() => {
        lift.mouseDown();
      }}
      onPointerDown={(event) => {
        lift.press();
        if (event.pointerType === "mouse") return;
        const snapshot = store.get();
        const { slot } = slotAt(event);
        gesture.current = {
          pinned: snapshot.pinned,
          slot,
          shown: context.hasToggles() && snapshot.source === "pointer" && snapshot.active === slot,
        };
        // A new tap ends a dismissal, so a third tap on the same slot opens the tooltip again.
        if (snapshot.dismissed !== null) store.set({ dismissed: null });
        pick(event);
      }}
      onPointerUp={(event) => {
        // A touch or pen lift pins the slot it ended on, and a tap on the pinned slot dismisses it.
        const started = gesture.current;
        gesture.current = null;
        if (event.pointerType === "mouse" || started === null) return;
        const snapshot = store.get();
        const slot = started.pinned ? started.slot : snapshot.active;
        if (slot === null) return;
        lift.lift();
        press(event, slot, started.shown && slot === started.slot);
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      onPointerLeave={(event) => {
        // A pointer that moves into the tooltip keeps the slot, so the popup stays hoverable.
        const intoPopup =
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest('[data-slot="chart-tooltip"]') !== null;
        if (
          !intoPopup &&
          event.pointerType === "mouse" &&
          store.get().source === "pointer" &&
          !store.get().pinned
        ) {
          store.set({ active: null, source: null, near: null });
        }
        // Leaving the plot ends a dismissal, so re-entering the same slot opens the popup again.
        if (!intoPopup && event.pointerType === "mouse" && store.get().dismissed !== null) {
          store.set({ dismissed: null });
        }
      }}
      onClick={(event) => {
        // A touch or pen press already acted on its lift, so only a mouse click and a keyboard
        // or assistive click, which reports a detail of 0, act here.
        if (!lift.clickActs(event)) return;
        if (event.detail === 0) {
          const { active } = store.get();
          if (active !== null) press(event, active);
          return;
        }
        press(event, slotAt(event).slot);
      }}>
      <SurfaceName {...naming} />
      {options.map((option) => {
        const slot = slotOfOption(context, window, option);
        const isCurrent = option === current;
        // Once the plot is measured, the option covers its slot's pixel columns, the same ones as
        // the crosshair band and the tooltip anchor.
        const band =
          drawn === null ? undefined : optionBand(drawn.frame, slot - window.first, context.xScale);
        return (
          <div
            key={option.id}
            id={option.id}
            // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- the legend owns selection, so options mark none
            role="option"
            data-slot="chart-point"
            data-focus-ring-control=""
            tabIndex={isCurrent ? 0 : -1}
            aria-label={optionName(context, slot, option.focus, option.order, emphasis)}
            aria-posinset={slot - window.first + 1}
            aria-setsize={count}
            aria-describedby={option.entry ? `${id}-description ${id}-instructions` : undefined}
            style={{
              "--chart-col": slot - window.first + 1,
              "--chart-option-start": band === undefined ? undefined : `${String(band[0])}px`,
              "--chart-option-size": band === undefined ? undefined : `${String(band[1] - band[0])}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Root's status region, which announces what Root's store says. */
export function ChartStatus(): ReactElement {
  const { store } = useChartRoot("Chart.Root");
  const text = useChartStore(store, (snapshot) => snapshot.announcement.text);
  const count = useChartStore(store, (snapshot) => snapshot.announcement.count);
  return <StatusRegion text={text} count={count} />;
}

Object.assign(ChartSurface, { displayName: "Chart.Root.Surface" });
Object.assign(ChartStatus, { displayName: "Chart.Root.Status" });
