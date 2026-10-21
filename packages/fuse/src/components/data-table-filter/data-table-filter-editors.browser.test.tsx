/**
 * Browser project. The editors' drafts and the operators every action writes: a draft commits
 * only on an explicit close step, a clear or a remove cancels it, each kind keeps one draft in
 * its positions, IME composition never commits, and every written filter survives the field-aware
 * parse. Expected rows and states are written out by hand from the shared fixture's six rows.
 */
import { createRef, useEffect, useLayoutEffect, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  columnFilters,
  CUSTOMER_NORD,
  FIELDS,
  focusIs,
  menuOpen,
  Orders,
  renderOrders,
  settled,
  visibleOrders,
} from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { glidePointerTo, turnWheel, whilePointerPressed } from "../../../test/pointer-press";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { DataTableFilterContextValue } from "./data-table-filter";
import { useDataTableFilter } from "./data-table-filter";
import type { FilterFieldMap } from "./filter-fields";
import { parseColumnFilters } from "./filter-parse";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await settled();
});

/**
 * Runs the clock past the text editor's 300 ms typing pause, then waits out the overlays' close
 * animations. The suite's timers are fake but advance with real time, so the overlays run as
 * they do for a person.
 */
async function outlastPauses(): Promise<void> {
  await vi.advanceTimersByTimeAsync(1000);
  await settled();
}

/** Moves focus to an element, which blurs the one that had it. */
function focusOn(element: Element): void {
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a focusable element");
  }
  element.focus();
}

/** Status is paid. */
const STATUS_PAID = [{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }];

/** Picks an option once the Select's popup has rendered it. */
async function pickOption(name: string): Promise<void> {
  await expect.poll(() => page.getByRole("option", { name, exact: true }).query()).not.toBeNull();
  await userEvent.click(roleNamed("option", name));
}

/** Waits for React to render what the last state change scheduled. */
async function nextFrame(): Promise<void> {
  await new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

/** The open value popover's dialog, named after its field. */
function popoverOpen(name: string): boolean {
  return page.getByRole("dialog", { name }).query() !== null;
}

describe("DataTableFilter text drafts", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a filter cleared while its value popover holds an unapplied draft gone", async () => {
    renderOrders({ initial: CUSTOMER_NORD });
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.keyboard("{End}x");
    await userEvent.click(roleNamed("button", "Clear filters"));
    await outlastPauses();
    expect(columnFilters()).toEqual([]);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });

  it("keeps a filter cleared while the menu's in-place editor holds an unapplied draft gone", async () => {
    renderOrders({ initial: [] });
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.keyboard("kafe");
    // Accents ignored: "kafe" matches Nordlys Kafé only.
    await expect.poll(visibleOrders).toBe("4");
    await userEvent.keyboard("x");
    await userEvent.click(roleNamed("button", "Clear filters"));
    await outlastPauses();
    expect(columnFilters()).toEqual([]);
    expect(menuOpen()).toBe(false);
  });

  it("keeps a removed filter gone while its value popover holds an unapplied draft", async () => {
    renderOrders({ initial: CUSTOMER_NORD });
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.keyboard("{End}x");
    await userEvent.click(roleNamed("button", "Remove Customer filter"));
    await outlastPauses();
    expect(columnFilters()).toEqual([]);
  });

  it("applies the typed text when the popover is dismissed before the pause ends", async () => {
    renderOrders({ initial: CUSTOMER_NORD });
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    // Tab moves focus out of the popover, which dismisses it.
    await userEvent.keyboard("{Tab}");
    await outlastPauses();
    expect(columnFilters()).toEqual([
      { id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } },
    ]);
    expect(visibleOrders()).toBe("1");
  });
});

describe("DataTableFilter draft ownership", () => {
  // The typing pause cannot fire unless a test advances the clock, so every write below comes from
  // the exit or the press under test. Animations run on frames, which stay real.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const captured = createRef<DataTableFilterContextValue["actions"]>();
  function Capture() {
    const { actions } = useDataTableFilter();
    useLayoutEffect(() => {
      captured.current = actions;
    });
    return null;
  }
  function act(): DataTableFilterContextValue["actions"] {
    if (captured.current === null) {
      throw new Error("expected the filter's actions");
    }
    return captured.current;
  }

  /** The number of writes TanStack has heard so far, and the render's unmount. */
  type WriteCounter = { readonly writes: () => number; readonly unmount: () => void };

  /** Renders the fixture under a write counter, with Capture. */
  function renderCounted(
    initial: ColumnFiltersState,
    bar: ReactElement = <DataTableFilter.Bar />
  ): WriteCounter {
    let count = 0;
    const view = renderThemed(
      withLocale(
        "en-US",
        <Orders
          initial={initial}
          onColumnFiltersChange={() => {
            count += 1;
          }}>
          {bar}
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
          <Capture />
        </Orders>
      )
    );
    return {
      writes: () => count,
      unmount: () => {
        view.unmount();
      },
    };
  }

  /** Renders Customer "nord" and Status paid, counts writes, and opens Customer's popover. */
  async function editCustomer(): Promise<WriteCounter> {
    const counted = renderCounted([...CUSTOMER_NORD, ...STATUS_PAID]);
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await settled();
    return counted;
  }

  /** Waits out the overlays' animations, then runs the clock past the typing pause. */
  async function outlast(): Promise<void> {
    await settled();
    await vi.advanceTimersByTimeAsync(1000);
    await settled();
  }

  type Exit = readonly [name: string, exit: () => Promise<void>, dismissed: () => boolean];
  const customerClosed = () => !popoverOpen("Customer");
  const EXITS: readonly Exit[] = [
    ["Enter", () => userEvent.keyboard("{Enter}"), customerClosed],
    ["Escape", () => userEvent.keyboard("{Escape}"), customerClosed],
    ["Tab out", () => userEvent.keyboard("{Tab}"), customerClosed],
    [
      "an outside press",
      async () => {
        // The viewport's far corner, away from the bar, its Clear and the popover below the chips.
        await userEvent.click(document.documentElement, {
          position: { x: window.innerWidth - 4, y: window.innerHeight - 4 },
        });
      },
      customerClosed,
    ],
    [
      "a move to Status through edit()",
      async () => {
        act().edit("status");
        await Promise.resolve();
      },
      () => popoverOpen("Status") && customerClosed(),
    ],
  ];

  it.each(EXITS)(
    "sends the typed text in exactly one write on %s, and none after",
    async (_name, exit, dismissed) => {
      const { writes } = await editCustomer();
      await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
      expect(writes()).toBe(0);
      await exit();
      await expect.poll(dismissed).toBe(true);
      await settled();
      expect(writes()).toBe(1);
      // Aurora Bakeri's order is paid: order 1.
      await expect.poll(visibleOrders).toBe("1");
      await outlast();
      expect(writes()).toBe(1);
    }
  );

  it("converts the typed text, not the applied one, when the operator changes mid-pause", async () => {
    const { writes } = await editCustomer();
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    const dialog = page.elementLocator(roleNamed("dialog", "Customer"));
    await userEvent.click(dialog.getByRole("combobox", { name: "Customer operator" }).element());
    await pickOption("does not contain");
    // Paid orders not from Aurora: Havbris's order 3.
    await expect.poll(visibleOrders).toBe("3");
    expect(writes()).toBe(1);
    expect(roleNamed("textbox", "Customer")).toHaveProperty("value", "aurora");
  });

  /** Opens the add menu, drills Customer and types text the pause has not applied. */
  async function draftInMenu(): Promise<WriteCounter> {
    const counted = renderCounted([...CUSTOMER_NORD, ...STATUS_PAID]);
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.fill(roleNamed("textbox", "Customer"), "kafe");
    return counted;
  }

  /** Opens Customer's value popover and types text the pause has not applied. */
  async function draftInPopover(): Promise<WriteCounter> {
    const counted = await editCustomer();
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    return counted;
  }

  /** A pointer press, or a click with no pointer at all, as assistive technology sends. */
  const PRESSES = [
    ["a pointer press", (button: HTMLElement) => userEvent.click(button)],
    [
      "a click without a pointer",
      async (button: HTMLElement) => {
        button.click();
        await Promise.resolve();
      },
    ],
  ] as const;
  const DRAFTS = [
    ["the menu's in-place editor", draftInMenu],
    ["the value popover", draftInPopover],
  ] as const;
  const CLEARS = DRAFTS.flatMap(([place, draft]) =>
    PRESSES.map(([press, act]) => [place, press, draft, act] as const)
  );

  it.each(CLEARS)(
    "clears in one write while %s holds unapplied text, on %s",
    async (_place, _press, draft, press) => {
      const { writes } = await draft();
      expect(writes()).toBe(0);
      await press(roleNamed("button", "Clear filters"));
      await outlast();
      expect(writes()).toBe(1);
      expect(columnFilters()).toEqual([]);
    }
  );

  it.each(PRESSES)("removes the edited chip in one write on %s", async (_press, press) => {
    const { writes } = await draftInPopover();
    await press(roleNamed("button", "Remove Customer filter"));
    await outlast();
    expect(writes()).toBe(1);
    expect(columnFilters()).toEqual(STATUS_PAID);
  });

  it("applies the edited chip's text and removes another chip on a press on its Remove", async () => {
    const { writes } = await draftInPopover();
    await userEvent.click(roleNamed("button", "Remove Status filter"));
    await outlast();
    expect(writes()).toBe(2);
    expect(columnFilters()).toEqual([
      { id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } },
    ]);
  });

  it("drops the unapplied text when a press on Clear slides off before its click", async () => {
    const { writes } = await draftInPopover();
    await glidePointerTo(roleNamed("button", "Clear filters"));
    await whilePointerPressed(async () => {
      await expect.poll(() => popoverOpen("Customer")).toBe(false);
      await glidePointerTo(roleNamed("status", "Visible orders"));
    });
    await outlast();
    expect(writes()).toBe(0);
    expect(columnFilters()).toEqual([...CUSTOMER_NORD, ...STATUS_PAID]);
  });

  it("writes nothing after the Root unmounts in the middle of a press on Clear", async () => {
    const { writes, unmount } = await draftInPopover();
    await glidePointerTo(roleNamed("button", "Clear filters"));
    await whilePointerPressed(async () => {
      await expect.poll(() => popoverOpen("Customer")).toBe(false);
      unmount();
    });
    await outlast();
    expect(writes()).toBe(0);
  });

  /** Opens a chip's value popover from its Value, the chip's first button. */
  async function openChip(chip: string, dialog: string): Promise<void> {
    const [value] = page.elementLocator(roleNamed("group", chip)).getByRole("button").elements();
    if (value === undefined) {
      throw new Error(`expected ${chip}'s Value`);
    }
    await userEvent.click(value);
    await expect.poll(() => popoverOpen(dialog)).toBe(true);
    await settled();
  }

  const AMOUNT_RANGE = { id: "amount", value: { kind: "number", operator: "isBetween", values: [120, 950] } };
  const CREATED_RANGE = {
    id: "created",
    value: { kind: "date", operator: "isBetween", values: ["2026-10-01", "2026-10-31"] },
  };

  /** Editors whose controls commit on blur, each left dirty and focused. */
  const BLUR_WRITERS = [
    [
      "a number editor",
      AMOUNT_RANGE,
      "Amount",
      async () => {
        await openChip("Amount filter", "Amount");
        await userEvent.fill(roleNamed("textbox", "Minimum"), "300");
      },
    ],
    [
      "a date editor",
      CREATED_RANGE,
      "Created",
      async () => {
        await openChip("Created filter", "Created");
        await userEvent.fill(
          page.elementLocator(roleNamed("dialog", "Created")).getByLabelText("From"),
          "2026-10-03"
        );
      },
    ],
  ] as const;

  it("moves focus into the editor edit() switches an open popover to, as a press on its Value does", async () => {
    renderCounted([AMOUNT_RANGE, ...CUSTOMER_NORD]);
    await openChip("Customer filter", "Customer");
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    act().edit("amount");
    await expect.poll(() => popoverOpen("Amount")).toBe(true);
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
    await settled();
    expect(focusIs("textbox", "Minimum")).toBe(true);
  });

  it("leaves another field's open editor and its draft alone on remove() of a field with no filter", async () => {
    const { writes } = renderCounted([AMOUNT_RANGE]);
    await openChip("Amount filter", "Amount");
    await userEvent.fill(roleNamed("textbox", "Minimum"), "300");
    act().remove("status");
    await outlast();
    expect(popoverOpen("Amount")).toBe(true);
    expect(roleNamed("textbox", "Minimum")).toHaveProperty("value", "300");
    expect(writes()).toBe(0);
    expect(columnFilters()).toEqual([AMOUNT_RANGE]);
  });

  it.each(BLUR_WRITERS)(
    "clears in one write with %s dirty and focused",
    async (_name, filter, _field, dirty) => {
      const { writes } = renderCounted([filter, ...STATUS_PAID]);
      await dirty();
      expect(writes()).toBe(0);
      await userEvent.click(roleNamed("button", "Clear filters"));
      await outlast();
      expect(writes()).toBe(1);
      expect(columnFilters()).toEqual([]);
    }
  );

  it.each(BLUR_WRITERS)(
    "removes the edited chip in one write with %s dirty and focused",
    async (_name, filter, field, dirty) => {
      const { writes } = renderCounted([filter, ...STATUS_PAID]);
      await dirty();
      await userEvent.click(roleNamed("button", `Remove ${field} filter`));
      await outlast();
      expect(writes()).toBe(1);
      expect(columnFilters()).toEqual(STATUS_PAID);
    }
  );

  it("settles the draft and clears nothing when Tab merely moves focus to a Clear outside the bar", async () => {
    let count = 0;
    renderThemed(
      withLocale(
        "en-US",
        <Orders
          initial={[...CUSTOMER_NORD, ...STATUS_PAID]}
          onColumnFiltersChange={() => {
            count += 1;
          }}>
          <DataTableFilter.Bar />
          {/* The next stop after the bar, where Tab out of the popover lands. */}
          <DataTableFilter.Clear>Reset</DataTableFilter.Clear>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </Orders>
      )
    );
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await settled();
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => focusIs("button", "Reset")).toBe(true);
    await expect.poll(() => popoverOpen("Customer")).toBe(false);
    await outlast();
    expect(count).toBe(1);
    expect(columnFilters()).toEqual([
      { id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } },
      ...STATUS_PAID,
    ]);
  });

  it("applies the text 300 ms after the last keystroke while the host re-renders every 100 ms", async () => {
    let count = 0;
    function Host() {
      const [, setTick] = useState(0);
      useEffect(() => {
        const timer = setInterval(() => {
          setTick((tick) => tick + 1);
        }, 100);
        return () => {
          clearInterval(timer);
        };
      }, []);
      return (
        <Orders
          initial={[...CUSTOMER_NORD, ...STATUS_PAID]}
          onColumnFiltersChange={() => {
            count += 1;
          }}
        />
      );
    }
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    renderThemed(withLocale("en-US", <Host />));
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await settled();
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    await vi.advanceTimersByTimeAsync(250);
    expect(count).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(count).toBe(1);
    await expect.poll(visibleOrders).toBe("1");
  });

  /** The part of a React event a consumer's handler below touches. */
  type ConsumerEvent = { preventDefault: () => void; stopPropagation: () => void };

  /** The default bar, written out with consumer handlers on Clear and every Remove. */
  function barWith(handlers: {
    readonly onPointerDownCapture?: (event: ConsumerEvent) => void;
    readonly onClickCapture?: (event: ConsumerEvent) => void;
  }): ReactElement {
    return (
      <DataTableFilter.Bar>
        <DataTableFilter.Trigger />
        <DataTableFilter.Chips>
          <DataTableFilter.Chip>
            <DataTableFilter.Subject />
            <DataTableFilter.Operator />
            <DataTableFilter.Value />
            <DataTableFilter.Remove {...handlers} />
          </DataTableFilter.Chip>
        </DataTableFilter.Chips>
        <DataTableFilter.Clear {...handlers} />
      </DataTableFilter.Bar>
    );
  }

  /** Opens Customer's popover in a fixture with the given bar and types unapplied text. */
  async function draftWithBar(bar: ReactElement): Promise<WriteCounter> {
    const counted = renderCounted([...CUSTOMER_NORD, ...STATUS_PAID], bar);
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await settled();
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    return counted;
  }

  const preventPress = barWith({
    onPointerDownCapture: (event) => {
      event.preventDefault();
    },
  });

  it("clears in one write when a consumer prevents the press on Clear", async () => {
    const { writes } = await draftWithBar(preventPress);
    await userEvent.click(roleNamed("button", "Clear filters"));
    await outlast();
    expect(writes()).toBe(1);
    expect(columnFilters()).toEqual([]);
  });

  it("removes in one write when a consumer prevents the press on the edited chip's Remove", async () => {
    const { writes } = await draftWithBar(preventPress);
    await userEvent.click(roleNamed("button", "Remove Customer filter"));
    await outlast();
    expect(writes()).toBe(1);
    expect(columnFilters()).toEqual(STATUS_PAID);
  });

  const stopClick = barWith({
    onClickCapture: (event) => {
      event.stopPropagation();
    },
  });

  it("closes the editor without a write when a consumer stops Clear's click", async () => {
    const { writes } = await draftWithBar(stopClick);
    roleNamed("button", "Clear filters").click();
    await expect.poll(() => popoverOpen("Customer")).toBe(false);
    await outlast();
    expect(writes()).toBe(0);
    expect(columnFilters()).toEqual([...CUSTOMER_NORD, ...STATUS_PAID]);
  });

  it("closes the editor without a write after a press on Clear that dismisses nothing and never clicks", async () => {
    const { writes } = await draftInPopover();
    // Safari's order: the press reaches Clear, nothing dismisses the popover, and no click follows.
    roleNamed("button", "Clear filters").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse", button: 0 })
    );
    await expect.poll(() => popoverOpen("Customer")).toBe(false);
    await outlast();
    expect(writes()).toBe(0);
    expect(columnFilters()).toEqual([...CUSTOMER_NORD, ...STATUS_PAID]);
  });

  it("drops a number typed before a cancelled Clear, even when Tab follows", async () => {
    const { writes } = renderCounted([AMOUNT_RANGE, ...STATUS_PAID], stopClick);
    await openChip("Amount filter", "Amount");
    await userEvent.fill(roleNamed("textbox", "Minimum"), "300");
    await userEvent.click(roleNamed("button", "Clear filters"));
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => popoverOpen("Amount")).toBe(false);
    await outlast();
    expect(writes()).toBe(0);
    expect(columnFilters()).toEqual([AMOUNT_RANGE, ...STATUS_PAID]);
  });

  it("closes an open date editor without a write on a cancelled Clear", async () => {
    const { writes } = renderCounted([CREATED_RANGE, ...STATUS_PAID], stopClick);
    await openChip("Created filter", "Created");
    await userEvent.click(roleNamed("button", "Clear filters"));
    await expect.poll(() => popoverOpen("Created")).toBe(false);
    await outlast();
    expect(writes()).toBe(0);
    expect(columnFilters()).toEqual([CREATED_RANGE, ...STATUS_PAID]);
  });

  // A press on a disabled Remove or Clear is a press on nothing that acts: it dismisses the popover
  // as any outside press does, which applies the typed text in one write, and every filter stays.
  // The same text after a press on another chip's field name, which does nothing, is the oracle.
  const DISMISSED = [
    { id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } },
    ...STATUS_PAID,
  ];

  it("applies the typed text on an outside press, the baseline for a disabled control", async () => {
    const { writes } = await draftWithBar(<DataTableFilter.Bar />);
    await userEvent.click(
      page.getByRole("group", { name: "Status filter" }).getByText("Status", { exact: true })
    );
    await expect.poll(() => popoverOpen("Customer")).toBe(false);
    await outlast();
    expect(writes()).toBe(1);
    expect(columnFilters()).toEqual(DISMISSED);
  });

  /** The default bar, written out with props on its Bar, each Chip, each Remove and Clear. */
  function barDisabling(parts: {
    readonly bar?: boolean;
    readonly chip?: boolean;
    readonly remove?: ComponentProps<typeof DataTableFilter.Remove>;
    readonly clear?: boolean;
  }): ReactElement {
    return (
      <DataTableFilter.Bar disabled={parts.bar}>
        <DataTableFilter.Trigger />
        <DataTableFilter.Chips>
          <DataTableFilter.Chip disabled={parts.chip}>
            <DataTableFilter.Subject />
            <DataTableFilter.Operator />
            <DataTableFilter.Value />
            <DataTableFilter.Remove {...parts.remove} />
          </DataTableFilter.Chip>
        </DataTableFilter.Chips>
        <DataTableFilter.Clear disabled={parts.clear} />
      </DataTableFilter.Bar>
    );
  }

  /**
   * Opens Customer's popover with an enabled bar, types unapplied text, then disables the parts,
   * since a disabled Chip or Bar disables the Value that opens the popover too.
   */
  async function draftThenDisable(
    parts: Parameters<typeof barDisabling>[0],
    press: string
  ): Promise<WriteCounter> {
    const disable = createRef<() => void>();
    function Switchable(): ReactElement {
      const [disabled, setDisabled] = useState(false);
      useLayoutEffect(() => {
        disable.current = () => {
          setDisabled(true);
        };
      });
      return barDisabling(disabled ? parts : {});
    }
    const counted = await draftWithBar(<Switchable />);
    disable.current?.();
    await expect.poll(() => roleNamed("button", press).getAttribute("aria-disabled")).toBe("true");
    return counted;
  }

  const DISABLED_PRESSES: readonly (readonly [
    name: string,
    parts: Parameters<typeof barDisabling>[0],
    press: string,
  ])[] = [
    ["a disabled Remove", { remove: { disabled: true } }, "Remove Customer filter"],
    [
      "a disabled span Remove",
      { remove: { disabled: true, nativeButton: false, render: <span /> } },
      "Remove Customer filter",
    ],
    ["a disabled Clear", { clear: true }, "Clear filters"],
    ["a Remove the Chip disables", { chip: true }, "Remove Customer filter"],
    ["a Remove the Bar disables", { bar: true }, "Remove Customer filter"],
  ];

  for (const [name, parts, press] of DISABLED_PRESSES) {
    it(`applies the typed text and keeps every filter on a press on ${name}`, async () => {
      const { writes } = await draftThenDisable(parts, press);
      expect(popoverOpen("Customer")).toBe(true);
      await userEvent.click(roleNamed("button", press), { force: true });
      await expect.poll(() => popoverOpen("Customer")).toBe(false);
      await outlast();
      expect(writes()).toBe(1);
      expect(columnFilters()).toEqual(DISMISSED);
    });
  }

  it("keeps two filters on one page apart: a Clear in one settles the other's open editor", async () => {
    let first = 0;
    let second = 0;
    renderThemed(
      withLocale(
        "en-US",
        <>
          <section aria-label="First orders">
            <Orders
              initial={[...CUSTOMER_NORD, ...STATUS_PAID]}
              onColumnFiltersChange={() => {
                first += 1;
              }}
            />
          </section>
          <section aria-label="Second orders">
            <Orders
              initial={STATUS_PAID}
              onColumnFiltersChange={() => {
                second += 1;
              }}
            />
          </section>
        </>
      )
    );
    const one = page.elementLocator(roleNamed("region", "First orders"));
    const two = page.elementLocator(roleNamed("region", "Second orders"));
    await userEvent.click(one.getByRole("button", { name: "“nord”" }).element());
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await settled();
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    await userEvent.click(two.getByRole("button", { name: "Clear filters" }).element());
    await outlast();
    expect([first, second]).toEqual([1, 1]);
    expect(one.getByRole("status", { name: "Column filters" }).element().textContent).toBe(
      JSON.stringify([
        { id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } },
        ...STATUS_PAID,
      ])
    );
    expect(two.getByRole("status", { name: "Column filters" }).element().textContent).toBe("[]");
  });

  it("opens a fresh editor when edit() reopens the menu during a Clear's close", async () => {
    const { writes } = renderCounted(STATUS_PAID);
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.click(roleNamed("button", "Clear filters"));
    act().edit("customer");
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await settled();
    await userEvent.fill(roleNamed("textbox", "Customer"), "kafe");
    const dialog = page.elementLocator(roleNamed("dialog", "Add filter"));
    await userEvent.click(dialog.getByRole("combobox", { name: "Customer operator" }).element());
    await pickOption("does not contain");
    await outlast();
    expect(columnFilters()).toEqual([
      { id: "customer", value: { kind: "text", operator: "doesNotContain", values: ["kafe"] } },
    ]);
    expect(writes()).toBe(2);
  });

  it("keeps a filter cleared from code gone when a focused, edited number field then blurs", async () => {
    const { writes } = renderCounted([
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [120, 950] } },
    ]);
    const [value] = page.elementLocator(roleNamed("group", "Amount filter")).getByRole("button").elements();
    if (value === undefined) {
      throw new Error("expected the Amount chip's Value");
    }
    await userEvent.click(value);
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
    await userEvent.fill(roleNamed("textbox", "Minimum"), "300");
    expect(writes()).toBe(0);
    act().clear();
    await Promise.resolve();
    focusOn(roleNamed("button", "After the bar"));
    await outlast();
    expect(writes()).toBe(1);
    expect(columnFilters()).toEqual([]);
  });

  it("writes nothing for two operator changes on an untouched number draft", async () => {
    const { writes } = renderCounted([]);
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
    const dialog = page.elementLocator(roleNamed("dialog", "Add filter"));
    await userEvent.click(dialog.getByRole("combobox", { name: "Amount operator" }).element());
    await pickOption("is greater than");
    await userEvent.click(dialog.getByRole("combobox", { name: "Amount operator" }).element());
    await pickOption("is less than");
    await outlast();
    expect(writes()).toBe(0);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");

    await userEvent.fill(roleNamed("textbox", "Amount"), "500");
    await userEvent.click(dialog.getByRole("combobox", { name: "Amount operator" }).element());
    await pickOption("is greater than");
    await expect
      .poll(columnFilters)
      .toEqual([{ id: "amount", value: { kind: "number", operator: "isGreaterThan", values: [500] } }]);
    // Above 500: Havbris at 950 and Bryggen at 780.
    expect(visibleOrders()).toBe("3 6");
  });
});

describe("DataTableFilter date range drafts", () => {
  it("keeps a To date typed first in To, and applies once From is set", async () => {
    renderOrders({ initial: [] });
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(() => roleNamed("dialog", "Add filter").getAttribute("data-step")).toBe("editor");
    const dialog = page.elementLocator(roleNamed("dialog", "Add filter"));
    const from = dialog.getByLabelText("From", { exact: true });
    const to = dialog.getByLabelText("To", { exact: true });
    await userEvent.fill(to, "2026-10-10");
    // Moving focus to From blurs To and keeps focus in the editor. Tab inside a date input moves
    // between its own segments.
    focusOn(from.element());
    await settled();
    expect(to.element()).toHaveProperty("value", "2026-10-10");
    expect(from.element()).toHaveProperty("value", "");
    expect(columnFilters()).toEqual([]);

    await userEvent.fill(from, "2026-10-01");
    focusOn(to.element());
    // Created from October 1 to 10: Aurora's order on the 2nd and Fjellstue's on the 5th.
    await expect.poll(visibleOrders).toBe("1 2");
  });
});

describe("DataTableFilter value popover height", () => {
  afterEach(async () => {
    await page.viewport(414, 896);
  });

  it("keeps a tall editor inside a short viewport, scrolling under its header, and never the page", async () => {
    await page.viewport(900, 480);
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ paddingBottom: "200vh" }}>
          <Orders
            initial={[
              {
                id: "created",
                value: { kind: "date", operator: "isBetween", values: ["2026-09-01", "2026-09-30"] },
              },
            ]}>
            <DataTableFilter.Bar />
            <DataTableFilter.Content />
            <DataTableFilter.ValueContent>
              <DataTableFilter.Editor>
                <DataTableFilter.DateEditor>
                  {(editor) => (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ height: 600 }}>A tall calendar</div>
                      <button
                        type="button"
                        onClick={() => {
                          editor.onValueChange(["2026-10-01", "2026-10-31"]);
                        }}>
                        October
                      </button>
                    </div>
                  )}
                </DataTableFilter.DateEditor>
              </DataTableFilter.Editor>
            </DataTableFilter.ValueContent>
          </Orders>
        </div>
      )
    );
    const [value] = page.elementLocator(roleNamed("group", "Created filter")).getByRole("button").elements();
    if (value === undefined) {
      throw new Error("expected the Created chip's Value");
    }
    await userEvent.click(value);
    await expect.poll(() => popoverOpen("Created")).toBe(true);
    await settled();
    const popup = roleNamed("dialog", "Created");
    const frame = popup.getBoundingClientRect();
    expect(frame.top).toBeGreaterThanOrEqual(0);
    expect(frame.bottom).toBeLessThanOrEqual(window.innerHeight);
    const before = window.scrollY;
    await glidePointerTo(roleNamed("button", "Today"));
    await turnWheel(2000);
    await settled();
    const october = roleNamed("button", "October");
    const box = october.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(popup.getBoundingClientRect().bottom);
    expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(october);
    expect(window.scrollY).toBe(before);
    await userEvent.click(october);
    // Every order but Nordlys Kafé's, from September 28, falls in October.
    await expect.poll(visibleOrders).toBe("1 2 3 5 6");
    expect(window.scrollY).toBe(before);
  });
});

describe("DataTableFilter IME composition", () => {
  // The typing pause cannot apply the typed text early on a slow runner: nothing advances it.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function keydown(target: Element, key: string, isComposing: boolean): void {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, isComposing, bubbles: true, cancelable: true }));
  }

  it("neither applies nor closes on an Enter that ends a composition", async () => {
    renderOrders({ initial: CUSTOMER_NORD });
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    const input = roleNamed("textbox", "Customer");
    await userEvent.keyboard("{End}x");
    keydown(input, "Enter", true);
    expect(columnFilters()).toEqual(CUSTOMER_NORD);
    // Safari fires compositionend before the keydown that ends the composition, with
    // isComposing already false.
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "x" }));
    keydown(input, "Enter", false);
    expect(columnFilters()).toEqual(CUSTOMER_NORD);
    await settled();
    expect(popoverOpen("Customer")).toBe(true);
  });

  it("keeps the menu's in-place editor on an Escape that ends a composition", async () => {
    renderOrders({ initial: [] });
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    const input = roleNamed("textbox", "Customer");
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "k" }));
    keydown(input, "Escape", false);
    await settled();
    expect(roleNamed("dialog", "Add filter").getAttribute("data-step")).toBe("editor");
  });
});

describe("DataTableFilter number and date drafts", () => {
  const fields: FilterFieldMap = {
    ...FIELDS,
    amount: { kind: "number", label: "Amount", step: 10, operators: ["isGreaterThan", "isLessThan"] },
  };

  it("applies a field whose first operator takes one value, on blur, on Enter and on a stepper press", async () => {
    renderOrders({ initial: [], fields });
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(() => focusIs("textbox", "Amount")).toBe(true);
    await userEvent.fill(roleNamed("textbox", "Amount"), "500");
    // Shift+Tab blurs the field and keeps focus in the editor, on the slider.
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    // Above 500: Bryggen at 780 and Havbris at 950.
    await expect.poll(visibleOrders).toBe("3 6");

    await userEvent.fill(roleNamed("textbox", "Amount"), "770");
    await userEvent.keyboard("{Enter}");
    await expect.poll(menuOpen).toBe(false);
    expect(columnFilters()).toEqual([
      { id: "amount", value: { kind: "number", operator: "isGreaterThan", values: [770] } },
    ]);

    await userEvent.click(roleNamed("button", "770"));
    await expect.poll(() => popoverOpen("Amount")).toBe(true);
    await userEvent.click(roleNamed("button", "Increase"));
    // Above 780: Havbris only.
    await expect.poll(visibleOrders).toBe("3");
  });

  it("keeps each range endpoint in its own field when Maximum is typed first", async () => {
    // Server mode without facets: no known range, so both fields start empty.
    renderOrders({ initial: [], manual: true });
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
    await userEvent.fill(roleNamed("textbox", "Maximum"), "500");
    // Shift+Tab blurs Maximum and keeps focus in the editor, on Minimum.
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await settled();
    expect(roleNamed("textbox", "Minimum")).toHaveProperty("value", "");
    expect(roleNamed("textbox", "Maximum")).toHaveProperty("value", "500");
    expect(columnFilters()).toEqual([]);

    await userEvent.fill(roleNamed("textbox", "Minimum"), "100");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect
      .poll(columnFilters)
      .toEqual([{ id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } }]);
  });

  it("applies a date edited after a range filter became a single date", async () => {
    renderOrders({
      initial: [
        {
          id: "created",
          value: { kind: "date", operator: "isBetween", values: ["2026-10-01", "2026-10-10"] },
        },
      ],
    });
    const chip = page.elementLocator(roleNamed("group", "Created filter"));
    const [value] = chip.getByRole("button").elements();
    if (value === undefined) {
      throw new Error("expected the Created chip's Value");
    }
    await userEvent.click(value);
    await expect.poll(() => popoverOpen("Created")).toBe(true);
    const dialog = page.elementLocator(roleNamed("dialog", "Created"));
    await userEvent.click(dialog.getByRole("combobox", { name: "Created operator" }).element());
    await pickOption("is");
    await expect
      .poll(columnFilters)
      .toEqual([{ id: "created", value: { kind: "date", operator: "is", values: ["2026-10-01"] } }]);
    const input = dialog.getByLabelText("Created", { exact: true });
    await userEvent.fill(input, "2026-10-05");
    if (!(input.element() instanceof HTMLElement)) {
      throw new Error("expected the date input");
    }
    input.element().blur();
    // Fjellstue's order is the one created on October 5.
    await expect.poll(visibleOrders).toBe("2");
  });
});

describe("DataTableFilter operators a field allows", () => {
  const captured = createRef<DataTableFilterContextValue["actions"]>();
  function Capture() {
    const { actions } = useDataTableFilter();
    useLayoutEffect(() => {
      captured.current = actions;
    });
    return null;
  }
  function act(): DataTableFilterContextValue["actions"] {
    if (captured.current === null) {
      throw new Error("expected the filter's actions");
    }
    return captured.current;
  }

  const RESTRICTED: FilterFieldMap = {
    ...FIELDS,
    status: { ...FIELDS.status, operators: ["is", "isNot"] },
    tags: { ...FIELDS.tags, operators: ["includesAllOf"] },
    amount: { kind: "number", label: "Amount", operators: ["isGreaterThan"] },
    created: { kind: "date", label: "Created", operators: ["is", "isBefore"] },
  };
  const ANY_OF_ONLY: FilterFieldMap = { ...FIELDS, status: { ...FIELDS.status, operators: ["isAnyOf"] } };

  type Step = (api: DataTableFilterContextValue["actions"]) => void;
  type Case = readonly [name: string, fields: FilterFieldMap, steps: readonly Step[], expected: unknown];

  const CASES: readonly Case[] = [
    [
      "a tick of a value the field does not offer writes nothing",
      FIELDS,
      [(api) => api.toggle("status", "void")],
      [],
    ],
    [
      "setValues with a value the field does not offer writes nothing",
      FIELDS,
      [(api) => api.setValues("status", "is", ["void"])],
      [],
    ],
    [
      "setValues with one offered and one unknown tag writes nothing",
      FIELDS,
      [(api) => api.setValues("tags", "includesAnyOf", ["priority", "nope"])],
      [],
    ],
    [
      "a second tick replaces the first in an option field without isAnyOf",
      RESTRICTED,
      [(api) => api.toggle("status", "paid"), (api) => api.toggle("status", "pending")],
      [{ id: "status", value: { kind: "option", operator: "is", values: ["pending"] } }],
    ],
    [
      "one tick reads is in an option field that allows only isAnyOf",
      ANY_OF_ONLY,
      [(api) => api.toggle("status", "paid")],
      [{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }],
    ],
    [
      "two ticks read isAnyOf in an option field that allows only isAnyOf",
      ANY_OF_ONLY,
      [(api) => api.toggle("status", "paid"), (api) => api.toggle("status", "pending")],
      [{ id: "status", value: { kind: "option", operator: "isAnyOf", values: ["paid", "pending"] } }],
    ],
    [
      "two ticks keep includesAllOf in a multi-option field that allows only it",
      RESTRICTED,
      [(api) => api.toggle("tags", "priority"), (api) => api.toggle("tags", "export")],
      [
        {
          id: "tags",
          value: { kind: "multiOption", operator: "includesAllOf", values: ["priority", "export"] },
        },
      ],
    ],
    [
      "setValues with an operator the field leaves out writes nothing",
      RESTRICTED,
      [(api) => api.setValues("amount", "isBetween", [100, 500])],
      [],
    ],
    [
      "setOperator to an operator the field leaves out keeps the filter",
      RESTRICTED,
      [
        (api) => api.setValues("amount", "isGreaterThan", [100]),
        (api) => api.setOperator("amount", "isBetween"),
      ],
      [{ id: "amount", value: { kind: "number", operator: "isGreaterThan", values: [100] } }],
    ],
    [
      "a date range on a field without isBetween writes nothing",
      RESTRICTED,
      [(api) => api.setValues("created", "isBetween", ["2026-10-01", "2026-10-10"])],
      [],
    ],
  ];

  it.each(CASES)("%s, and the parse keeps every written filter", async (_name, fields, steps, expected) => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[]} fields={fields}>
          <Capture />
        </Orders>
      )
    );
    for (const step of steps) {
      step(act());
      await nextFrame();
    }
    await expect.poll(columnFilters).toEqual(expected);
    expect(parseColumnFilters(columnFilters(), fields)).toEqual(expected);
  });

  it("offers only Today, as is, on a date field without isBetween", async () => {
    renderOrders({ initial: [], fields: RESTRICTED });
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(() => roleNamed("dialog", "Add filter").getAttribute("data-step")).toBe("editor");
    expect(page.getByRole("button", { name: "Last 7 days" }).query()).toBeNull();
    expect(page.getByRole("button", { name: "This year" }).query()).toBeNull();
    await userEvent.click(roleNamed("button", "Today"));
    // The fixture compares calendar days in UTC.
    const today = new Date().toISOString().slice(0, 10);
    const expected = [{ id: "created", value: { kind: "date", operator: "is", values: [today] } }];
    await expect.poll(columnFilters).toEqual(expected);
    expect(parseColumnFilters(columnFilters(), RESTRICTED)).toEqual(expected);
  });
});

describe("DataTableFilter drafts under a host that republishes its filters", () => {
  /** The republishes so far. */
  function republishes(): number {
    return Number(roleNamed("status", "Republishes").textContent);
  }

  /** Waits for two more republishes, so at least one landed after the edit. */
  async function outlastRepublishes(): Promise<void> {
    const from = republishes();
    await expect.poll(republishes).toBeGreaterThanOrEqual(from + 2);
  }

  const captured = createRef<DataTableFilterContextValue["actions"]>();
  function Capture(): null {
    const { actions } = useDataTableFilter();
    useLayoutEffect(() => {
      captured.current = actions;
    });
    return null;
  }

  /** The fixture, controlled, republishing deep copies of unchanged filters every 50 ms. */
  function renderRepublishing(initial: ColumnFiltersState): void {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={initial} onColumnFiltersChange={() => undefined} republishEvery={50}>
          <DataTableFilter.Bar />
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
          <Capture />
        </Orders>
      )
    );
  }

  async function openValue(chip: string, dialog: string): Promise<void> {
    await userEvent.click(page.getByRole("group", { name: chip }).getByRole("button").first());
    await expect.poll(() => popoverOpen(dialog)).toBe(true);
  }

  it("keeps typed text through republished copies and applies it after the pause", async () => {
    renderRepublishing(CUSTOMER_NORD);
    await openValue("Customer filter", "Customer");
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    await expect
      .poll(columnFilters)
      .toEqual([{ id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } }]);
    expect(roleNamed("textbox", "Customer")).toHaveProperty("value", "aurora");
  });

  it("keeps a typed number through republished copies and applies it on Enter", async () => {
    renderRepublishing([
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [120, 950] } },
    ]);
    await openValue("Amount filter", "Amount");
    await userEvent.fill(roleNamed("textbox", "Minimum"), "300");
    await outlastRepublishes();
    expect(roleNamed("textbox", "Minimum")).toHaveProperty("value", "300");
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(columnFilters)
      .toEqual([{ id: "amount", value: { kind: "number", operator: "isBetween", values: [300, 950] } }]);
  });

  it("keeps a typed date through republished copies and applies it on blur", async () => {
    renderRepublishing([
      { id: "created", value: { kind: "date", operator: "isBetween", values: ["2026-10-01", "2026-10-31"] } },
    ]);
    await openValue("Created filter", "Created");
    const from = page.elementLocator(roleNamed("dialog", "Created")).getByLabelText("From");
    await userEvent.fill(from, "2026-10-03");
    await outlastRepublishes();
    await expect.element(from).toHaveValue("2026-10-03");
    // Tab steps through a native date input's own day, month and year fields, so the test blurs it.
    from.element().blur();
    await expect.poll(columnFilters).toEqual([
      {
        id: "created",
        value: { kind: "date", operator: "isBetween", values: ["2026-10-03", "2026-10-31"] },
      },
    ]);
  });

  it("still follows a real change of the applied filter while a draft is open", async () => {
    // The typing pause waits on a frozen clock, so the typed text stays a draft until the change.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    renderRepublishing(CUSTOMER_NORD);
    await openValue("Customer filter", "Customer");
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    captured.current?.setValues("customer", "contains", ["kafe"]);
    await expect.poll(() => roleNamed("textbox", "Customer")).toHaveProperty("value", "kafe");
    await outlastRepublishes();
    expect(columnFilters()).toEqual([
      { id: "customer", value: { kind: "text", operator: "contains", values: ["kafe"] } },
    ]);
  });
});
