/**
 * Browser project. Every handler a part owns also takes the consumer's: the consumer's runs, and
 * the part's own behaviour still works. Each row names the part, the handler, what fires it, and
 * the part's own behaviour as an outcome only that behaviour produces.
 */
import type { ReactElement } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  columnFilters,
  CUSTOMER_NORD,
  focusIs,
  menuOpen,
  Orders,
  settled,
  STATUS_THREE,
} from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await settled();
});

/** The consumer's handler under test. */
type Spy = ReturnType<typeof vi.fn>;

/** The default bar, written out with one consumer handler on one part. */
function bar(part: string, handler: string, spy: Spy): ReactElement {
  const on = (name: string) => (part === name ? { [handler]: spy } : {});
  return (
    <DataTableFilter.Bar>
      <DataTableFilter.Trigger {...on("Trigger")} />
      <DataTableFilter.Chips {...on("Chips")}>
        <DataTableFilter.Chip {...on("Chip")}>
          <DataTableFilter.Subject />
          <DataTableFilter.Operator />
          <DataTableFilter.Value {...on("Value")} />
          <DataTableFilter.Remove {...on("Remove")} />
        </DataTableFilter.Chip>
      </DataTableFilter.Chips>
      <DataTableFilter.Clear {...on("Clear")} />
    </DataTableFilter.Bar>
  );
}

/** The overlays, with one consumer handler on Content or an Editor. */
function overlays(part: string, handler: string, spy: Spy): ReactElement {
  const on = (name: string) => (part === name ? { [handler]: spy } : {});
  return (
    <>
      <DataTableFilter.Content {...on("Content")}>
        <DataTableFilter.FieldList />
        <DataTableFilter.Editor {...on("Editor")}>
          <DataTableFilter.TextEditor />
        </DataTableFilter.Editor>
      </DataTableFilter.Content>
      <DataTableFilter.ValueContent>
        <DataTableFilter.Editor {...on("Editor")}>
          <DataTableFilter.TextEditor />
        </DataTableFilter.Editor>
      </DataTableFilter.ValueContent>
    </>
  );
}

const AMOUNT: ColumnFiltersState = [
  { id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } },
];

type Setup = { readonly initial: ColumnFiltersState; readonly width?: number; readonly noContent?: boolean };

/** Renders the fixture with one consumer handler, and counts writes. */
function renderWith(part: string, handler: string, spy: Spy, setup: Setup): () => number {
  let writes = 0;
  renderThemed(
    withLocale(
      "en-US",
      <div style={{ width: setup.width ?? "100%" }}>
        <Orders
          initial={setup.initial}
          onColumnFiltersChange={() => {
            writes += 1;
          }}>
          {bar(part, handler, spy)}
          {setup.noContent === true ? <DataTableFilter.ValueContent /> : overlays(part, handler, spy)}
        </Orders>
      </div>
    )
  );
  return () => writes;
}

async function nextFrames(): Promise<void> {
  for (let frame = 0; frame < 3; frame += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

async function openCustomer(): Promise<void> {
  await userEvent.click(roleNamed("button", "“nord”"));
  await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
  await settled();
}

/** Opens Customer's popover and types text the pause has not applied yet. */
async function dirtyCustomer(): Promise<void> {
  await openCustomer();
  await userEvent.fill(roleNamed("textbox", "Customer"), "aurora");
}

async function drillCustomer(): Promise<void> {
  await userEvent.click(roleNamed("button", "Filter"));
  await settled();
  await userEvent.click(roleNamed("menuitem", "Customer"));
  await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
  await settled();
}

function popoverOpen(): boolean {
  return page.getByRole("dialog", { name: "Customer" }).query() !== null;
}

type Row = {
  readonly part: string;
  readonly handler: string;
  readonly setup?: Setup;
  /**
   * Freezes `setTimeout`, so the text editor's 300 ms pause and the composition guard's 5 ms hold
   * run only when the row advances them, and a slow runner cannot apply typed text early.
   */
  readonly frozenClock?: true;
  readonly act: () => Promise<void>;
  readonly works: (writes: () => number) => Promise<void>;
};

/** A destructive press with a dirty editor: one write, the destructive one, and the editor closes. */
function destructive(
  part: "Remove" | "Clear",
  handler: string,
  press: (button: HTMLElement) => Promise<void>
): Row {
  const name = part === "Clear" ? "Clear filters" : "Remove Customer filter";
  return {
    part,
    handler,
    frozenClock: true,
    act: async () => {
      await dirtyCustomer();
      await press(roleNamed("button", name));
    },
    works: async (writes) => {
      await expect.poll(popoverOpen).toBe(false);
      await expect.poll(columnFilters).toEqual([]);
      await settled();
      expect(writes()).toBe(1);
    },
  };
}

const pointerPress = (button: HTMLElement) => userEvent.click(button);
const pointerlessClick = async (button: HTMLElement) => {
  button.click();
  await Promise.resolve();
};

/**
 * The error a click handler threw, which the browser reports on the window. The listener runs at
 * the window ahead of the test runner's and keeps the expected error from failing the run.
 */
async function errorFromClick(button: HTMLElement): Promise<string | null> {
  let thrown: string | null = null;
  const catchError = (event: ErrorEvent) => {
    thrown = event.error instanceof Error ? event.error.name : null;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener("error", catchError, true);
  try {
    button.click();
    await Promise.resolve();
  } finally {
    window.removeEventListener("error", catchError, true);
  }
  return thrown;
}

let triggerError: string | null = null;

const ROWS: readonly Row[] = [
  {
    part: "Trigger",
    handler: "onClick",
    // Without Content, the Trigger's own handler names the missing part in development.
    setup: { initial: CUSTOMER_NORD, noContent: true },
    act: async () => {
      triggerError = await errorFromClick(roleNamed("button", "Filter"));
    },
    works: async () => {
      await Promise.resolve();
      expect(triggerError).toBe("DataTableFilterCompositionError");
    },
  },
  {
    part: "Value",
    handler: "onClick",
    act: openCustomer,
    works: () => expect.poll(() => focusIs("textbox", "Customer")).toBe(true),
  },
  {
    part: "Chip",
    handler: "onKeyDown",
    act: async () => {
      roleNamed("button", "“nord”").focus();
      await userEvent.keyboard("{Delete}");
    },
    works: () => expect.poll(columnFilters).toEqual([]),
  },
  {
    part: "Chips",
    handler: "onFocus",
    // Three chips in a narrow bar: the strip scrolls sideways.
    setup: { initial: [...CUSTOMER_NORD, ...STATUS_THREE, ...AMOUNT], width: 360 },
    act: async () => {
      // Without the browser's own scroll, so only the part's scrolls the segment into view.
      roleNamed("button", "Remove Amount filter").focus({ preventScroll: true });
      await nextFrames();
    },
    works: async () => {
      await nextFrames();
      // DOM audit: the strip is a layout box with no role; its scroll position is the behaviour.
      const strip = roleNamed("button", "Remove Amount filter").closest(
        "[data-slot=data-table-filter-chips]"
      );
      expect(strip?.scrollLeft ?? 0).toBeGreaterThan(0);
    },
  },
  {
    part: "Remove",
    handler: "onClick",
    act: () => userEvent.click(roleNamed("button", "Remove Customer filter")),
    works: () => expect.poll(columnFilters).toEqual([]),
  },
  {
    part: "Clear",
    handler: "onClick",
    act: () => userEvent.click(roleNamed("button", "Clear filters")),
    works: () => expect.poll(columnFilters).toEqual([]),
  },
  destructive("Remove", "onPointerDownCapture", pointerPress),
  destructive("Remove", "onClickCapture", pointerlessClick),
  destructive("Clear", "onPointerDownCapture", pointerPress),
  destructive("Clear", "onClickCapture", pointerlessClick),
  {
    part: "Content",
    handler: "onKeyDown",
    act: async () => {
      await userEvent.click(roleNamed("button", "Filter"));
      await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
      await userEvent.keyboard("{ArrowRight}");
    },
    // The toolbar never takes the key: focus stays in the menu's search.
    works: async () => {
      await settled();
      expect(focusIs("searchbox", "Search fields")).toBe(true);
      expect(menuOpen()).toBe(true);
    },
  },
  {
    part: "Content",
    handler: "onTransitionEnd",
    act: async () => {
      await userEvent.click(roleNamed("button", "Filter"));
      await settled();
      await userEvent.click(roleNamed("menuitem", "Customer"));
      await settled();
    },
    // The drill's height morph hands the height back to the content when it ends.
    works: () => expect.poll(() => roleNamed("dialog", "Add filter").style.height).toBe(""),
  },
  {
    part: "Editor",
    handler: "onKeyDown",
    act: async () => {
      await drillCustomer();
      await userEvent.keyboard("{Escape}");
    },
    works: () =>
      expect.poll(() => roleNamed("dialog", "Add filter").getAttribute("data-step")).toBe("fields"),
  },
  {
    part: "Editor",
    handler: "onCompositionStart",
    frozenClock: true,
    act: async () => {
      await openCustomer();
      const input = roleNamed("textbox", "Customer");
      await userEvent.fill(input, "aurora");
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      await userEvent.keyboard("{Enter}");
    },
    // An Enter while a composition is open neither applies nor closes.
    works: async (writes) => {
      await settled();
      expect(popoverOpen()).toBe(true);
      expect(writes()).toBe(0);
    },
  },
  {
    part: "Editor",
    handler: "onCompositionEnd",
    frozenClock: true,
    act: async () => {
      await openCustomer();
      const input = roleNamed("textbox", "Customer");
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "a" }));
      // Past the guard's 5 ms hold after a composition ends.
      await vi.advanceTimersByTimeAsync(5);
      await userEvent.fill(input, "aurora");
      await userEvent.keyboard("{Enter}");
    },
    // Enter after the composition still applies and closes.
    works: async () => {
      await expect.poll(popoverOpen).toBe(false);
      expect(columnFilters()).toEqual([
        { id: "customer", value: { kind: "text", operator: "contains", values: ["aurora"] } },
      ]);
    },
  },
];

describe("DataTableFilter consumer handlers", () => {
  it.each(ROWS.map((row) => [row.part, row.handler, row] as const))(
    "%s keeps its own %s behaviour and calls the consumer's",
    async (part, handler, row) => {
      const spy = vi.fn();
      if (row.frozenClock === true) {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        onTestFinished(() => {
          vi.useRealTimers();
        });
      }
      const writes = renderWith(part, handler, spy, row.setup ?? { initial: CUSTOMER_NORD });
      await row.act();
      await row.works(writes);
      expect(spy).toHaveBeenCalled();
    }
  );
});
