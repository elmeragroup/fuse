/**
 * Browser project. The editors' drafts and the operators every action writes: a draft commits
 * only on an explicit close step, a clear or a remove cancels it, each kind keeps one draft in
 * its positions, IME composition never commits, and every written filter survives the field-aware
 * parse. Expected rows and states are written out by hand from the shared fixture's six rows.
 */
import { createRef, useLayoutEffect, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { useFakeTimeouts } from "../../../test/animation-frames";
import {
  captureActions,
  columnFilters,
  CUSTOMER_NORD,
  finishMotion,
  focusIs,
  Orders,
  popoverOpen,
  renderCounted,
} from "../../../test/data-table-filter-fixture";
import type { CountedRender } from "../../../test/data-table-filter-fixture";
import { roleNamed } from "../../../test/themed-browser-render";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await finishMotion();
});

/** Status is paid. */
const STATUS_PAID = [{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }];

describe("DataTableFilter draft ownership", () => {
  // The typing pause cannot fire unless a test advances the clock, so every write below comes from
  // the exit or the press under test. Animations run on frames, which stay real.
  beforeEach(() => {
    useFakeTimeouts();
  });

  const { Capture, act } = captureActions();

  /** Renders the fixture under a write counter, with Capture. */
  function renderDrafts(
    initial: ColumnFiltersState,
    bar: ReactElement = <DataTableFilter.Bar />
  ): CountedRender {
    return renderCounted((onColumnFiltersChange) => (
      <Orders initial={initial} onColumnFiltersChange={onColumnFiltersChange}>
        {bar}
        <DataTableFilter.Content />
        <DataTableFilter.ValueContent />
        <Capture />
      </Orders>
    ));
  }

  /** Waits out the overlays' animations, then runs the clock past the typing pause. */
  async function outlast(): Promise<void> {
    await finishMotion();
    await vi.advanceTimersByTimeAsync(1000);
    await finishMotion();
  }

  /** Opens a chip's value popover from its Value, the chip's first button. */
  async function openChip(chip: string, dialog: string): Promise<void> {
    const [value] = page.elementLocator(roleNamed("group", chip)).getByRole("button").elements();
    if (value === undefined) {
      throw new Error(`expected ${chip}'s Value`);
    }
    await userEvent.click(value);
    await expect.poll(() => popoverOpen(dialog)).toBe(true);
    await finishMotion();
  }

  const AMOUNT_RANGE = { id: "amount", value: { kind: "number", operator: "isBetween", values: [120, 950] } };

  it("moves focus into the editor edit() switches an open popover to, as a press on its Value does", async () => {
    renderDrafts([AMOUNT_RANGE, ...CUSTOMER_NORD]);
    await openChip("Customer filter", "Customer");
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    act().edit("amount");
    await expect.poll(() => popoverOpen("Amount")).toBe(true);
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
    await finishMotion();
    expect(focusIs("textbox", "Minimum")).toBe(true);
  });

  /** Opens Customer's popover in a fixture with the given bar and types unapplied text. */
  async function draftWithBar(bar: ReactElement): Promise<CountedRender> {
    const counted = renderDrafts([...CUSTOMER_NORD, ...STATUS_PAID], bar);
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await finishMotion();
    await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
    return counted;
  }

  // A press on a disabled Remove or Clear is a press on nothing that acts: it dismisses the popover
  // as any outside press does, which applies the typed text in one write, and every filter stays.
  // The same text after a press on another chip's field name, which does nothing, is the oracle.
  const DISMISSED = [
    { id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } },
    ...STATUS_PAID,
  ];

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
  ): Promise<CountedRender> {
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
      await finishMotion();
      await expect.poll(() => popoverOpen("Customer")).toBe(false);
      await outlast();
      expect(writes()).toBe(1);
      expect(columnFilters()).toEqual(DISMISSED);
    });
  }
});
