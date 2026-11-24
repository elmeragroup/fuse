import { Activity } from "react";
import { useState } from "react";

import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, recordFrames, useFakeTimeouts } from "../../../test/animation-frames";
import { CaughtError, caughtError } from "../../../test/caught-error";
import {
  active,
  barWithValue,
  captureActions,
  chipStrip,
  columnFilters,
  CUSTOMER_NORD,
  FIELDS,
  finishMotion,
  Orders,
  PEEKING_FILTERS,
  renderOrders,
  renderCounted,
  STATUS_THREE,
  visibleOrders,
  focusIs,
  menuOpen,
  pickOption,
  popoverOpen,
  FIELDS_WITH_RUSH_TOGGLE,
  insideStrip,
  pressShownStart,
  renderAmountPeeking,
  shownStart,
  sizeAmountPeeking,
  tapShownStart,
  watchPressEndListeners,
} from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { whilePointerPressed } from "../../../test/pointer-press";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed, roleNamed, textNamed } from "../../../test/themed-browser-render";
import type { Finger, Touchscreen } from "../../../test/touch-input";
import { withTouchscreen } from "../../../test/touch-input";
import { useDataTableFilterChip } from "./data-table-filter-context";
import type { FilterField, FilterFieldMap } from "./filter-fields";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await emulateReducedMotion("no-preference");
  await page.viewport(414, 896);
});

describe("DataTableFilter bar", () => {
  it("names the toolbar, Trigger and chip segments, and roves them from one Tab stop with wrapping", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.keyboard("{Tab}");
    expect(active()).toBe(roleNamed("button", "Filter"));
    expect(roleNamed("group", "Status filter").contains(roleNamed("button", "Paid, Pending +1"))).toBe(true);
    const order = [
      roleNamed("combobox", "Status operator"),
      roleNamed("button", "Paid, Pending +1"),
      roleNamed("button", "Remove Status filter"),
      roleNamed("combobox", "Customer operator"),
      roleNamed("button", "“nord”"),
      roleNamed("button", "Remove Customer filter"),
      roleNamed("button", "Clear filters"),
    ];
    for (const next of order) {
      await userEvent.keyboard("{ArrowRight}");
      expect(active()).toBe(next);
    }
    await userEvent.keyboard("{ArrowRight}");
    expect(active()).toBe(roleNamed("button", "Filter"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(active()).toBe(roleNamed("button", "Clear filters"));
    await userEvent.keyboard("{Tab}");
    expect(roleNamed("toolbar", "Filters").contains(active())).toBe(false);
  });

  it.each([
    [
      "Bar outside its Root",
      <DataTableFilter.Bar key="bar" />,
      "DataTableFilter.Bar must be used within DataTableFilter.Root. Wrap the filter's parts in DataTableFilter.Root.",
    ],
    [
      "Value outside a chip",
      <Orders key="value" initial={[]}>
        <CaughtError>
          <DataTableFilter.Value />
        </CaughtError>
      </Orders>,
      "DataTableFilter.Value must be used within DataTableFilter.Chip, under DataTableFilter.Chips. Render it in the chip template.",
    ],
  ])("throws a DataTableFilterCompositionError for a %s", (_label, tree, message) => {
    renderThemed(withLocale("en-US", <CaughtError>{tree}</CaughtError>));
    expect(caughtError().name).toBe("DataTableFilterCompositionError");
    expect(caughtError().message).toBe(message);
  });
});

describe("DataTableFilter editors", () => {
  it("commits text on Enter, closes and returns focus to the renamed Value", async () => {
    renderOrders({ initial: CUSTOMER_NORD });
    await userEvent.click(roleNamed("button", "“nord”"));
    const input = roleNamed("textbox", "Customer");
    await expect.poll(active).toBe(input);
    await userEvent.fill(input, "fjell");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    expect(visibleOrders()).toBe("2");
    await expect.poll(active).toBe(roleNamed("button", "“fjell”"));
  });

  it("refuses a minimum above the maximum and keeps the last valid range", async () => {
    renderOrders({
      initial: [{ id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } }],
    });
    await userEvent.click(roleNamed("button", "100–500"));
    await userEvent.fill(roleNamed("textbox", "Minimum"), "950");
    // Tab blurs Minimum onto Maximum, which commits it and keeps the popover open.
    await userEvent.keyboard("{Tab}");
    await expect.element(page.getByText("The minimum is above the maximum.")).toBeInTheDocument();
    expect(visibleOrders()).toBe("1 2 5");

    await userEvent.fill(roleNamed("textbox", "Minimum"), "300");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    expect(columnFilters()).toEqual([
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [300, 500] } },
    ]);
  });

  it("commits a slider step from the keyboard", async () => {
    renderOrders({
      initial: [{ id: "amount", value: { kind: "number", operator: "isGreaterThan", values: [500] } }],
    });
    await userEvent.click(roleNamed("button", "500"));
    roleNamed("slider", "Amount").focus();
    await userEvent.keyboard("{ArrowRight}");
    // Above 510: Havbris Sjømat at 950 and Bryggen Bokhandel at 780.
    await expect.poll(visibleOrders).toBe("3 6");
    expect(roleNamed("button", "510")).toBeTruthy();
  });

  it("applies a typed date on blur and a preset that closes the editor", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    renderOrders({
      initial: [
        {
          id: "created",
          value: { kind: "date", operator: "isBetween", values: ["2026-10-01", "2026-10-10"] },
        },
      ],
    });
    expect(visibleOrders()).toBe("1 2");
    await userEvent.click(roleNamed("button", "Oct 1, 2026\u00a0–\u00a0Oct 10, 2026"));
    const to = page.getByLabelText("To", { exact: true });
    await userEvent.fill(to, "2026-10-12");
    // Tab steps through a native date input's own fields, so the test blurs it.
    to.element().blur();
    await expect.poll(visibleOrders).toBe("1 2 3");

    await userEvent.click(roleNamed("button", "Today"));
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    // Today is 2026-10-12, the day order 3 was created.
    expect(visibleOrders()).toBe("3");
  });
});

describe("DataTableFilter removal and focus", () => {
  it("clears every filter from the bar, moves focus to the Trigger and then renders no Clear", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Clear filters"));
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
    expect(page.getByRole("button", { name: "Clear filters" }).query()).toBeNull();
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });
});

describe("DataTableFilter value popover", () => {
  it("returns focus to the chip's Value when the editor closes", async () => {
    renderOrders({ initial: STATUS_THREE });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    await userEvent.keyboard("{Escape}");
    await expect.poll(active).toBe(roleNamed("button", "Paid, Pending +1"));
  });

  it("moves focus to the next chip when a press on an emptied chip's Value closes its editor", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await finishMotion();
    for (const option of ["Paid", "Pending", "Overdue"]) {
      await userEvent.click(roleNamed("option", option));
    }
    const chip = page.getByRole("group", { name: "Status filter" });
    await expect.poll(() => chip.element().hasAttribute("data-ghost")).toBe(true);
    // The chip's buttons are its Value, then its Remove.
    await userEvent.click(chip.getByRole("button").first());
    await expect.poll(() => chip.query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("combobox", "Customer operator"));
  });

  /** The value popover's positioner, while it is mounted. */
  const positioner = (): HTMLElement | null =>
    document.querySelector<HTMLElement>("[data-slot=data-table-filter-positioner]");

  it("moves from one chip to a partly hidden chip's pressed Value without clamping to the viewport edge", async () => {
    useFakeTimeouts();
    const { strip, segment: amountValue } = await renderAmountPeeking();
    const customerChip = page.getByRole("group", { name: "Customer filter" }).element();
    const amountChip = page.getByRole("group", { name: "Amount filter" }).element();
    await userEvent.click(roleNamed("button", "“nord”"));
    await finishMotion();
    const positionerLeft = () => positioner()?.getBoundingClientRect().left;
    const openedLeft = positionerLeft() ?? Number.NaN;
    // A draft the move settles widens Customer's chip, which pushes Amount's further out. The typing
    // pause has not run out, so the summary still shows the applied value.
    await userEvent.fill(roleNamed("textbox", "Customer"), "nordlys og fjellvind");
    expect(page.getByRole("button", { name: "“nord”", exact: true }).query()).not.toBeNull();

    // Unit under test: the popover's drawn left edge on each frame of the move. Oracle: the strip's
    // start. The popover lines up with its chip, which sits inside the strip at both ends of the
    // move, so no frame of the glide between them draws left of it. A popover that followed
    // Customer's chip out of the strip clamps at the viewport's 8px edge, left of the strip.
    const stripLeft = strip.getBoundingClientRect().left;
    const clamped = (left: number | undefined) => left === undefined || left < stripLeft - 0.5;
    let released = false;
    // The move ends once Amount's dialog shows and its positioner rests aligned with Amount's chip,
    // at the chip's start, or at its end where the start would overflow the viewport. The page-wide
    // dialog query runs last, only on a frame that may have settled.
    const settledOnAmount = () => {
      const element = positioner();
      if (element?.getAnimations().length !== 0) {
        return false;
      }
      const box = element.getBoundingClientRect();
      const chip = amountChip.getBoundingClientRect();
      const aligned = [chip.left, chip.right - box.width].some((left) => Math.abs(box.left - left) < 0.5);
      return aligned && popoverOpen("Amount");
    };
    // The recording stops at the first missing or clamped frame, or once the move settles.
    const frames = recordFrames(
      positionerLeft,
      () => clamped(positionerLeft()) || (released && settledOnAmount())
    );
    // The press holds through three frames, so a scroll on pointerdown draws before the release.
    await pressShownStart(amountValue, () => nextFrames(3));
    released = true;

    expect(openedLeft).toBeGreaterThanOrEqual(stripLeft - 0.5);
    expect((await frames).filter(clamped)).toEqual([]);
    expect(roleNamed("button", "“nordlys og fjellvind”")).toBeTruthy();
    // The strip scrolled Amount's chip into view and Customer's out past its start.
    expect(customerChip.getBoundingClientRect().left).toBeLessThan(strip.getBoundingClientRect().left);
    expect(insideStrip(strip, amountValue)).toBe(true);
  });

  it("opens the list of a partly hidden chip's pressed Operator", async () => {
    const { segment: operator } = await renderAmountPeeking(undefined, () =>
      roleNamed("combobox", "Amount operator")
    );
    // The press holds through three frames, so a scroll on pointerdown draws before the release.
    await pressShownStart(operator, () => nextFrames(3));
    await finishMotion();
    await expect.element(page.getByRole("listbox")).toBeVisible();
    expect(operator.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the popover for a pressed Value while the strip itself has focus", async () => {
    const { strip, segment: amountValue } = await renderAmountPeeking();
    strip.tabIndex = -1;
    strip.focus({ preventScroll: true });
    expect(active()).toBe(strip);
    await pressShownStart(amountValue, () => nextFrames(3));
    await finishMotion();
    expect(popoverOpen("Amount")).toBe(true);
    expect(insideStrip(strip, amountValue)).toBe(true);
  });

  it("holds the strip still under a press whose Value's own pointerdown capture replaces the pressed label", async () => {
    /** Amount's Value, whose pointerdown capture swaps its label for a new element, then focuses it. */
    function RelabelingValue() {
      const chip = useDataTableFilterChip();
      const [presses, setPresses] = useState(0);
      return (
        <DataTableFilter.Value
          onPointerDownCapture={(event) => {
            const value = event.currentTarget;
            flushSync(() => {
              setPresses((count) => count + 1);
            });
            value.focus({ preventScroll: true });
          }}>
          {chip.id === "amount" ? <span key={presses}>500</span> : undefined}
        </DataTableFilter.Value>
      );
    }
    const { strip, segment: pressedLabel } = await renderAmountPeeking(
      barWithValue(<RelabelingValue />),
      () => textNamed("500")
    );
    const scrollLeft = strip.scrollLeft;
    // Chromium sends no click for a press whose pressed node left the page, so the test reads the
    // strip while the press holds, three frames after a scroll on pointerdown would draw.
    await pressShownStart(pressedLabel, async () => {
      await nextFrames(3);
      expect({
        focused: focusIs("button", "500"),
        scrollLeft: strip.scrollLeft,
        labelAttached: pressedLabel.isConnected,
      }).toEqual({ focused: true, scrollLeft, labelAttached: false });
    });
  });

  it("opens the popover for a pressed Value whose own pointerdown capture focuses it", async () => {
    const { strip, segment: amountValue } = await renderAmountPeeking(
      barWithValue(
        <DataTableFilter.Value
          onPointerDownCapture={(event) => {
            event.currentTarget.focus({ preventScroll: true });
          }}
        />
      )
    );
    await pressShownStart(amountValue, () => nextFrames(3));
    await finishMotion();
    expect(popoverOpen("Amount")).toBe(true);
    expect(insideStrip(strip, amountValue)).toBe(true);
  });

  it("scrolls a Value into view on focus after a press on it that focused nothing ended outside the strip", async () => {
    const { strip, segment: amountValue } = await renderAmountPeeking(
      barWithValue(
        <DataTableFilter.Value
          onPointerDown={(event) => {
            event.preventDefault();
          }}
        />
      )
    );
    const below = strip.getBoundingClientRect().bottom + 40;
    // The release's click, outside the strip, focuses the Value. With `preventScroll`, only the
    // strip's own scroll can bring the Value into view.
    let focusedOnPress = false;
    document.addEventListener(
      "click",
      () => {
        focusedOnPress = document.activeElement === amountValue;
        amountValue.focus({ preventScroll: true });
      },
      { capture: true, once: true }
    );
    const pressEndListeners = await watchPressEndListeners();
    await pressShownStart(amountValue, () =>
      userEvent.hover(document.documentElement, { position: { x: 4, y: below }, force: true })
    );
    expect({
      focusedOnPress,
      focused: document.activeElement === amountValue,
      visible: insideStrip(strip, amountValue),
      pressEndListeners: await pressEndListeners(),
    }).toEqual({ focusedOnPress: false, focused: true, visible: true, pressEndListeners: 0 });
  });

  it.each([
    { segment: "Value", peeking: () => roleNamed("button", "500"), opened: () => popoverOpen("Amount") },
    {
      segment: "Operator",
      peeking: () => roleNamed("combobox", "Amount operator"),
      opened: () => page.getByRole("listbox").query() !== null,
    },
  ])("opens a partly hidden chip's tapped $segment", async ({ peeking, opened }) => {
    const { strip, segment } = await renderAmountPeeking(undefined, peeking);
    const scrollLeft = strip.scrollLeft;
    // A tap focuses at its mousedown, after the pointerup. A focus scroll then would move the
    // segment before the tap's mouseup and click land on it.
    let scrollAtMouseUp = Number.NaN;
    document.addEventListener(
      "mouseup",
      () => {
        scrollAtMouseUp = strip.scrollLeft;
      },
      { capture: true, once: true }
    );
    await tapShownStart(segment);
    await finishMotion();
    expect({ opened: opened(), scrollAtMouseUp }).toEqual({ opened: true, scrollAtMouseUp: scrollLeft });
  });

  it("opens a partly hidden chip's tapped Value whose own pointerup focuses it", async () => {
    let focusedOnPointerUp = false;
    const { segment: amountValue } = await renderAmountPeeking(
      barWithValue(
        <DataTableFilter.Value
          onPointerUp={(event) => {
            if (event.pointerType === "touch") {
              event.currentTarget.focus({ preventScroll: true });
              focusedOnPointerUp = document.activeElement === event.currentTarget;
            }
          }}
        />
      )
    );
    // A focus scroll at the pointerup moves the Value before the tap's mousedown and click, which
    // then land on the chip's Remove.
    await tapShownStart(amountValue);
    await finishMotion();
    expect({ focusedOnPointerUp, opened: popoverOpen("Amount") }).toEqual({
      focusedOnPointerUp: true,
      opened: true,
    });
  });

  it("holds the strip still under a held touch on a Value that its move focuses after a mouse release outside the strip", async () => {
    const { strip, segment: amountValue } = await renderAmountPeeking(
      barWithValue(
        <DataTableFilter.Value
          onPointerMove={(event) => {
            if (event.pointerType === "touch") {
              event.currentTarget.focus({ preventScroll: true });
            }
          }}
        />
      )
    );
    // The strip takes no touch pan, so the finger's move stays a pointermove.
    strip.style.touchAction = "none";
    const scrollLeft = strip.scrollLeft;
    const at = shownStart(amountValue);
    const below = strip.getBoundingClientRect().bottom + 40;
    // The strip is read while the finger is still down, three frames after a focus scroll would draw.
    const held = await withTouchscreen(async (screen) => {
      await screen.place([at]);
      await userEvent.hover(document.documentElement, { position: { x: 4, y: below }, force: true });
      await whilePointerPressed(() => nextFrames(1));
      await screen.move([{ x: at.x, y: at.y + 2 }]);
      await nextFrames(3);
      return { focused: document.activeElement === amountValue, scrollLeft: strip.scrollLeft };
    });
    expect(held).toEqual({ focused: true, scrollLeft });
  });

  /** Drags one finger down from `at` in six 20px steps, then lifts it. */
  const dragDown = async (screen: Touchscreen, at: Finger) => {
    await screen.place([at]);
    for (const step of [1, 2, 3, 4, 5, 6]) {
      await screen.move([{ x: at.x, y: at.y + step * 20 }]);
    }
    await screen.lift();
  };

  // Each touch gesture ends its press with no click or focus in the strip. A handler then focuses
  // the segment: in the last finger's touchend after a pointerup, in the pointercancel, or after the
  // gesture. A two-finger tap's focus waits until the press-end listeners are counted, so the count
  // shows that the lift alone removes them.
  it.each([
    {
      gesture: "a two-finger tap with one finger outside the strip",
      peeking: () => roleNamed("button", "500"),
      end: "pointerup",
      focusIn: "afterwards",
      run: async (screen: Touchscreen, at: Finger, strip: Element) => {
        await screen.place([at]);
        await screen.place([{ x: 20, y: strip.getBoundingClientRect().bottom + 200 }]);
        await screen.lift();
      },
    },
    {
      gesture: "a vertical drag on an Operator in a strip that pans only sideways",
      peeking: () => roleNamed("combobox", "Amount operator"),
      end: "pointerup",
      focusIn: "touchend",
      run: async (screen: Touchscreen, at: Finger, strip: HTMLElement) => {
        // Chromium cancels a touch whose drag pans, so the strip allows no vertical pan.
        strip.style.touchAction = "pan-x";
        await dragDown(screen, at);
      },
    },
    {
      gesture: "a vertical drag on a Value that the browser cancels to pan",
      peeking: () => roleNamed("button", "500"),
      end: "pointercancel",
      focusIn: "pointercancel",
      run: dragDown,
    },
  ])("scrolls a segment into view on a focus as $gesture ends", async ({ peeking, end, focusIn, run }) => {
    const { strip, segment } = await renderAmountPeeking(undefined, peeking);
    const at = shownStart(segment);
    // The contact that pressed the segment, and how it ended.
    let pressing: number | undefined;
    const ends: Array<string> = [];
    segment.addEventListener("pointerdown", (event) => {
      pressing = event.pointerId;
    });
    // With `preventScroll`, only the strip's own scroll can bring the segment into view.
    let focusedBefore = false;
    const restore = () => {
      focusedBefore = document.activeElement === segment;
      segment.focus({ preventScroll: true });
    };
    const onEnd = (event: PointerEvent) => {
      if (event.pointerId !== pressing) {
        return;
      }
      ends.push(event.type);
      if (event.type === focusIn) {
        restore();
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0 && focusIn === "touchend") {
        restore();
      }
    };
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
    document.addEventListener("touchend", onTouchEnd);
    onTestFinished(() => {
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      document.removeEventListener("touchend", onTouchEnd);
    });
    const pressEndListeners = await watchPressEndListeners();
    await withTouchscreen((screen) => run(screen, at, strip));
    const leftListeners = await pressEndListeners();
    if (focusIn === "afterwards") {
      restore();
    }
    expect({
      ends,
      focusedBefore,
      focused: document.activeElement === segment,
      visible: insideStrip(strip, segment),
      pressEndListeners: leftListeners,
    }).toEqual({ ends: [end], focusedBefore: false, focused: true, visible: true, pressEndListeners: 0 });
  });

  /**
   * Opens Customer's editor and scrolls the strip to 35px, where Customer's chip starts past the
   * strip's start and its Value shows whole. Returns Customer's Value.
   */
  const openCustomerScrolled = async (strip: HTMLElement) => {
    const customerValue = roleNamed("button", "“nord”");
    await userEvent.click(customerValue);
    await finishMotion();
    strip.scrollLeft = 35;
    const customerChip = roleNamed("group", "Customer filter");
    expect(customerChip.getBoundingClientRect().left).toBeLessThan(strip.getBoundingClientRect().left);
    expect(insideStrip(strip, customerValue)).toBe(true);
    return customerValue;
  };

  it("leaves the strip where it is when a press on the open chip's Value closes the popover", async () => {
    const { strip } = await renderAmountPeeking();
    const customerValue = await openCustomerScrolled(strip);

    await userEvent.click(customerValue);
    await finishMotion();
    expect({ open: popoverOpen("Customer"), scrollLeft: strip.scrollLeft }).toEqual({
      open: false,
      scrollLeft: 35,
    });
  });

  type Shown = { readonly filter: "hidden" | "visible"; readonly bar: "hidden" | "visible" };

  /**
   * Renders the Customer and Amount chips with the filter under an Activity, and returns a rerender
   * that sets the Activity's `mode` and toggles `display: none` on the Bar in one synchronous
   * commit. A hidden Bar stays mounted, so its chips and Values keep their refs.
   */
  const renderInActivity = () => {
    const { Capture, act } = captureActions();
    const view = (shown: Shown) =>
      withLocale(
        "en-US",
        <Activity mode={shown.filter}>
          <Orders initial={PEEKING_FILTERS}>
            <DataTableFilter.Bar {...(shown.bar === "hidden" && { style: { display: "none" } })} />
            <DataTableFilter.ValueContent />
            <Capture />
          </Orders>
        </Activity>
      );
    const { rerender } = renderThemed(view({ filter: "visible", bar: "visible" }));
    return { act, show: (shown: Shown) => rerender(view(shown)) };
  };

  it("keeps the strip's scroll when an Activity hides and reveals the filter with an editor open", async () => {
    const { show } = renderInActivity();
    const { strip } = await sizeAmountPeeking();
    await openCustomerScrolled(strip);

    show({ filter: "hidden", bar: "visible" });
    expect(strip.checkVisibility()).toBe(false);
    show({ filter: "visible", bar: "visible" });
    expect({ open: popoverOpen("Customer"), scrollLeft: strip.scrollLeft }).toEqual({
      open: true,
      scrollLeft: 35,
    });
  });

  it("reveals the edited Value when the filter shows again after edit() ran as the Bar hid", async () => {
    const { act, show } = renderInActivity();
    const { strip, segment: amountValue } = await sizeAmountPeeking();
    // An open editor keeps focus in the popover, so no focus lands in the strip to scroll it.
    await userEvent.click(roleNamed("button", "“nord”"));
    await finishMotion();

    // One commit moves the editor to Amount and hides the Bar with `display: none`, so Amount's chip
    // and Value stay registered but have no box to reveal.
    flushSync(() => {
      act().edit("amount");
      show({ filter: "visible", bar: "hidden" });
    });
    expect(strip.checkVisibility()).toBe(false);
    await expect.poll(() => popoverOpen("Amount")).toBe(true);
    show({ filter: "hidden", bar: "hidden" });
    expect(popoverOpen("Amount")).toBe(false);
    show({ filter: "visible", bar: "visible" });
    expect({
      open: popoverOpen("Amount"),
      revealed: amountValue.checkVisibility() && insideStrip(strip, amountValue),
    }).toEqual({ open: true, revealed: true });
  });

  it("reveals the edited chip when its Value has `display: none`", async () => {
    const { Capture, act } = captureActions();
    renderOrders({
      initial: PEEKING_FILTERS,
      children: (
        <>
          {barWithValue(<DataTableFilter.Value style={{ display: "none" }} />)}
          <Capture />
        </>
      ),
    });
    const strip = chipStrip();
    const amountChip = roleNamed("group", "Amount filter");
    // Amount's chip shows only its first half at the strip's end.
    const stripInset = window.innerWidth - strip.getBoundingClientRect().right;
    const chipRect = amountChip.getBoundingClientRect();
    await page.viewport(Math.round(chipRect.left + chipRect.width / 2 + stripInset), 896);
    expect(strip.clientWidth).toBeGreaterThan(chipRect.width);
    expect(insideStrip(strip, amountChip)).toBe(false);

    act().edit("amount");
    await expect.poll(() => popoverOpen("Amount")).toBe(true);
    expect(insideStrip(strip, amountChip)).toBe(true);
  });

  it("reveals the open chip's Value again when edit() asks for the field already open", async () => {
    const { Capture, act } = captureActions();
    const { strip, segment: amountValue } = await renderAmountPeeking(
      <>
        <DataTableFilter.Bar />
        <DataTableFilter.ValueContent />
        <Capture />
      </>
    );
    act().edit("amount");
    await expect.poll(() => popoverOpen("Amount")).toBe(true);
    await finishMotion();
    strip.scrollLeft = 0;
    expect(insideStrip(strip, amountValue)).toBe(false);

    act().edit("amount");
    await expect.poll(() => insideStrip(strip, amountValue)).toBe(true);
    expect(popoverOpen("Amount")).toBe(true);
  });

  it("reveals the pressed Value of a chip wider than the strip", async () => {
    renderOrders({
      initial: [
        { id: "amount", value: { kind: "number", operator: "isGreaterThan", values: [500] } },
        {
          id: "customer",
          value: {
            kind: "text",
            operator: "contains",
            values: ["nordlys og fjellvind og havbris i nord og sør"],
          },
        },
      ],
    });
    await page.viewport(360, 896);
    const strip = chipStrip();
    const customerChip = page.getByRole("group", { name: "Customer filter" });
    // The chip's buttons are its Value, then its Remove.
    const customerValue = customerChip.getByRole("button").first().element();
    // Customer's Value starts 30px before the strip's end, and its chip is wider than the strip.
    strip.scrollLeft = customerValue.getBoundingClientRect().left - strip.getBoundingClientRect().right + 30;
    expect(customerChip.element().getBoundingClientRect().width).toBeGreaterThan(strip.clientWidth);
    expect(insideStrip(strip, customerValue)).toBe(false);

    await pressShownStart(customerValue);
    await finishMotion();
    expect(popoverOpen("Customer")).toBe(true);
    expect(insideStrip(strip, customerValue)).toBe(true);
  });
});

describe("DataTableFilter composition", () => {
  /** The fixture's fields with one field replaced. */
  function withField(id: string, field: FilterField): FilterFieldMap {
    return { ...FIELDS, [id]: field };
  }

  /** Renders Status as any of three under a write counter, then restricts it to single-select. */
  function renderStaleMulti() {
    const single = withField("status", { ...FIELDS.status, operators: ["is", "isNot"] });
    const counted = renderCounted((onColumnFiltersChange) => (
      <Orders initial={STATUS_THREE} fields={FIELDS} onColumnFiltersChange={onColumnFiltersChange} />
    ));
    counted.rerender((onColumnFiltersChange) => (
      <Orders initial={STATUS_THREE} fields={single} onColumnFiltersChange={onColumnFiltersChange} />
    ));
    return counted;
  }

  const UNTICKS = [
    [
      "a value submenu",
      async () => {
        await userEvent.click(roleNamed("button", "Filter"));
        await finishMotion();
        await userEvent.click(roleNamed("menuitem", "Status"));
        await expect
          .poll(() => page.getByRole("menuitemcheckbox", { name: "Pending" }).query())
          .not.toBeNull();
        await userEvent.click(roleNamed("menuitemcheckbox", "Pending"));
      },
    ],
    [
      "quick search",
      async () => {
        await userEvent.click(roleNamed("button", "Filter"));
        await finishMotion();
        await userEvent.keyboard("pe");
        await expect
          .poll(() => page.getByRole("menuitemcheckbox", { name: "Status Pending" }).query())
          .not.toBeNull();
        await userEvent.click(roleNamed("menuitemcheckbox", "Status Pending"));
      },
    ],
    [
      "the chip's editor",
      async () => {
        await userEvent.click(roleNamed("button", "Paid, Pending +1"));
        await expect.poll(() => page.getByRole("option", { name: "Pending" }).query()).not.toBeNull();
        await userEvent.click(roleNamed("option", "Pending"));
      },
    ],
  ] as const;

  it.each(UNTICKS)(
    "removes a stale multi-selection in one write when a value is unticked in %s of a single-select field",
    async (_place, untick) => {
      const { writes } = renderStaleMulti();
      await untick();
      await expect.poll(columnFilters).toEqual([]);
      expect(writes()).toBe(1);
    }
  );

  it("moves focus to the previous chip's Remove, focusable only while enabled, then the Trigger", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              <DataTableFilter.Chip>
                <DataTableFilter.Subject />
                <DataTableFilter.Remove focusableWhenDisabled={false} />
              </DataTableFilter.Chip>
            </DataTableFilter.Chips>
          </DataTableFilter.Bar>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </Orders>
      )
    );
    roleNamed("button", "Remove Status filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("group", { name: "Status filter" }).query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("button", "Remove Customer filter"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
  });

  it("moves focus to the previous chip's non-native Remove, then the Trigger, after keyboard removes", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              <DataTableFilter.Chip>
                <DataTableFilter.Subject />
                <DataTableFilter.Operator />
                <DataTableFilter.Value />
                <DataTableFilter.Remove nativeButton={false} render={<span />} />
              </DataTableFilter.Chip>
            </DataTableFilter.Chips>
          </DataTableFilter.Bar>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </Orders>
      )
    );
    // The last chip goes first, so focus lands on the previous chip's last segment, the
    // non-native Remove.
    roleNamed("button", "Remove Status filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("group", { name: "Status filter" }).query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("button", "Remove Customer filter"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
  });

  /** A span Remove that leaves the tab order once disabled. */
  const spanRemove = (
    <DataTableFilter.Remove nativeButton={false} focusableWhenDisabled={false} render={<span />} />
  );

  for (const via of ["Chip", "Bar"] as const) {
    for (const key of ["Delete", "Backspace"] as const) {
      it(`keeps a chip the ${via} disables on ${key} from its span Remove`, async () => {
        renderThemed(
          withLocale(
            "en-US",
            <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
              <DataTableFilter.Bar disabled={via === "Bar"}>
                <DataTableFilter.Trigger />
                <DataTableFilter.Chips>
                  <DataTableFilter.Chip disabled={via === "Chip"}>
                    <DataTableFilter.Subject />
                    <DataTableFilter.Operator />
                    <DataTableFilter.Value />
                    {spanRemove}
                  </DataTableFilter.Chip>
                </DataTableFilter.Chips>
              </DataTableFilter.Bar>
            </Orders>
          )
        );
        const remove = roleNamed("button", "Remove Status filter");
        remove.focus();
        expect(active()).toBe(remove);
        await userEvent.keyboard(`{${key}}`);
        await finishMotion();
        expect(page.getByRole("group", { name: "Status filter" }).query()).not.toBeNull();
        expect(columnFilters()).toEqual([...CUSTOMER_NORD, ...STATUS_THREE]);
      });
    }
  }

  it("keeps a disabled chip on Delete once focus lands on its span Remove after a neighbor goes", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              {(chip) =>
                chip.id === "status" ? (
                  <DataTableFilter.Chip disabled>
                    <DataTableFilter.Subject />
                    {spanRemove}
                  </DataTableFilter.Chip>
                ) : (
                  <DataTableFilter.Chip />
                )
              }
            </DataTableFilter.Chips>
          </DataTableFilter.Bar>
        </Orders>
      )
    );
    roleNamed("button", "Remove Customer filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("group", { name: "Customer filter" }).query()).toBeNull();
    // The disabled chip's only segment is its span, which still takes focus from code.
    await expect.poll(active).toBe(roleNamed("button", "Remove Status filter"));
    await userEvent.keyboard("{Delete}");
    await finishMotion();
    expect(page.getByRole("group", { name: "Status filter" }).query()).not.toBeNull();
    expect(columnFilters()).toEqual(STATUS_THREE);
  });
});

describe("menu", () => {
  async function openMenu(): Promise<void> {
    await userEvent.click(roleNamed("button", "Filter"));
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
  }

  describe("DataTableFilter add menu", () => {
    it("opens a dialog of field rows in config order, and ticks values live with the menu open", async () => {
      renderOrders({ initial: [] });
      await openMenu();
      const trigger = roleNamed("button", "Filter");
      expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(
        page
          .getByRole("menuitem")
          .elements()
          .map((row) => row.textContent)
      ).toEqual(["Status", "Tags", "Customer", "Amount", "Created"]);
      expect(roleNamed("menuitem", "Status").getAttribute("aria-haspopup")).toBe("dialog");

      await userEvent.click(roleNamed("menuitem", "Status"));
      await userEvent.click(page.getByRole("menuitemcheckbox", { name: "Paid" }));
      await expect.poll(visibleOrders).toBe("1 3");
      expect(roleNamed("menuitemcheckbox", "Paid").getAttribute("aria-checked")).toBe("true");
      expect(menuOpen()).toBe(true);
    });

    it("applies a date preset and closes the menu with focus on the Trigger", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
      onTestFinished(() => {
        vi.useRealTimers();
      });
      renderOrders({ initial: [] });
      await openMenu();
      await userEvent.click(roleNamed("menuitem", "Created"));
      await userEvent.click(page.getByRole("button", { name: "Last 30 days" }));
      await expect.poll(menuOpen).toBe(false);
      await expect.poll(() => focusIs("button", "Filter")).toBe(true);
      // The 30 days through 2026-10-12, written out.
      expect(columnFilters()).toEqual([
        {
          id: "created",
          value: { kind: "date", operator: "isBetween", values: ["2026-09-13", "2026-10-12"] },
        },
      ]);
    });

    it("keeps ArrowRight, Home and End in the search when a pointer open highlights nothing", async () => {
      renderOrders({ initial: [] });
      await openMenu();
      for (const key of ["{ArrowRight}", "{Home}", "{End}"]) {
        await userEvent.keyboard(key);
        expect(active(), key).toBe(roleNamed("searchbox", "Search fields"));
        expect(menuOpen(), key).toBe(true);
      }
    });

    it("closes on Tab past the bar and on Shift+Tab back to the Trigger", async () => {
      renderOrders({ initial: [] });
      await openMenu();
      await userEvent.keyboard("{Tab}");
      await expect.poll(menuOpen).toBe(false);
      await expect.poll(() => focusIs("button", "After the bar")).toBe(true);
      await openMenu();
      await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
      await expect.poll(menuOpen).toBe(false);
      await expect.poll(() => focusIs("button", "Filter")).toBe(true);
    });

    it("says a field has a filter and opens its submenu with the chip's values checked and pinned", async () => {
      renderOrders({
        initial: [{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }],
      });
      await openMenu();
      expect(roleNamed("menuitem", "Status").getAttribute("aria-description")).toBe("Has a filter");
      expect(roleNamed("menuitem", "Tags").hasAttribute("aria-description")).toBe(false);
      await userEvent.click(roleNamed("menuitem", "Status"));
      await expect.poll(() => page.getByRole("menuitemcheckbox").elements().length).toBe(5);
      const rows = page.getByRole("menuitemcheckbox").elements();
      expect(rows.map((row) => row.textContent)).toEqual([
        "Paid2",
        "Draft1",
        "Pending2",
        "Overdue1",
        "Canceled0",
      ]);
      expect(roleNamed("menuitemcheckbox", "Paid").getAttribute("aria-checked")).toBe("true");
      expect(page.getByRole("separator").elements()).toHaveLength(1);
    });
  });

  // Rush over the six rows: orders 1, 3 and 6 are rush, 2 and 4 are not, and 5 has no value.
  const RUSH_TRUE = [{ id: "rush", value: { kind: "boolean", operator: "is", values: [true] } }];
  const RUSH_FALSE = [{ id: "rush", value: { kind: "boolean", operator: "is", values: [false] } }];

  describe("DataTableFilter toggles", () => {
    /** The toggle's chip, a group named after the field. */
    function chip(): HTMLElement {
      return roleNamed("group", "Rush only filter");
    }

    it("moves focus to Remove when an operator pick turns a stale toggle on", async () => {
      renderOrders({
        initial: [{ id: "rush", value: { kind: "boolean", operator: "isNot", values: [true] } }],
        fields: FIELDS_WITH_RUSH_TOGGLE,
      });
      await userEvent.click(roleNamed("combobox", "Rush only operator"));
      await pickOption("is");
      await expect.poll(columnFilters).toEqual(RUSH_TRUE);
      await expect.poll(() => focusIs("button", "Remove Rush only filter")).toBe(true);
      expect(page.elementLocator(chip()).getByRole("combobox").query()).toBeNull();
    });

    it("keeps a stale toggle's sentence while its value popover turns it on, then moves focus to Remove", async () => {
      renderOrders({ initial: RUSH_FALSE, fields: FIELDS_WITH_RUSH_TOGGLE });
      await userEvent.click(page.elementLocator(chip()).getByRole("button", { name: "No" }).element());
      await expect.poll(() => page.getByRole("dialog", { name: "Rush only" }).query()).not.toBeNull();
      await userEvent.click(
        page.elementLocator(roleNamed("dialog", "Rush only")).getByRole("option", { name: "Yes" }).element()
      );
      await expect.poll(columnFilters).toEqual(RUSH_TRUE);
      expect(page.elementLocator(chip()).getByRole("button", { name: "Yes" }).query()).not.toBeNull();
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => page.getByRole("dialog", { name: "Rush only" }).query()).toBeNull();
      await expect.poll(() => focusIs("button", "Remove Rush only filter")).toBe(true);
      expect(page.elementLocator(chip()).getByRole("combobox").query()).toBeNull();
    });
  });
});
