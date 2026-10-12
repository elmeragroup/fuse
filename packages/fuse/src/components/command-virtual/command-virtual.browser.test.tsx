import type { ReactElement, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Command } from "../command";
import { CommandVirtual } from "./index";

const METER_POINTS = Array.from(
  { length: 1000 },
  (_, index) => `Meter point ${String(index + 1).padStart(4, "0")}`
);

function renderPalette(node: ReactNode) {
  return renderThemed(withLocale("en-US", node));
}

function VirtualPalette({
  onRun,
  highlightItemOnHover = true,
}: {
  onRun: (item: string) => void;
  highlightItemOnHover?: boolean;
}): ReactElement {
  return (
    <Command.Root items={METER_POINTS} virtualized highlightItemOnHover={highlightItemOnHover}>
      <Command.Input aria-label="Meter points" />
      <Command.List render={<CommandVirtual.List />}>
        {(item: string) => (
          <Command.Item
            value={item}
            onClick={() => {
              onRun(item);
            }}>
            {item}
          </Command.Item>
        )}
      </Command.List>
    </Command.Root>
  );
}

function highlightedOption(): HTMLElement | undefined {
  return page
    .getByRole("option")
    .elements()
    .find(
      (option): option is HTMLElement =>
        option instanceof HTMLElement && option.hasAttribute("data-highlighted")
    );
}

function listbox(): HTMLElement {
  const element = page.getByRole("listbox").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the listbox");
  }
  return element;
}

/** Whether the element's box lies wholly inside the list's scrollport. */
function isInView(element: HTMLElement): boolean {
  const list = listbox().getBoundingClientRect();
  const row = element.getBoundingClientRect();
  return row.top >= list.top - 0.5 && row.bottom <= list.bottom + 0.5;
}

/** Focuses the input and waits for the first match's highlight. */
async function focusInput(): Promise<HTMLElement> {
  const input = roleNamed("combobox", "Meter points");
  input.focus();
  await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0001");
  return input;
}

/** Highlights the third row with the arrows, then wheels the list far past it. */
async function highlightThirdRowAndWheelAway(): Promise<void> {
  await userEvent.keyboard("{ArrowDown}{ArrowDown}");
  await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0003");
  await userEvent.wheel(listbox(), { delta: { y: 4000 } });
  await expect.poll(() => listbox().scrollTop).toBeGreaterThan(2000);
}

/** The lazy node React Flight produces for an element a Server Component passes to a client one. */
type FlightLazyNode = {
  readonly $$typeof: symbol;
  readonly _payload: ReactElement;
  readonly _init: (payload: ReactElement) => ReactElement;
};

/** Wraps an element as React Flight hands it to a client component's render prop. */
function flightLazyElement(element: ReactElement): ReactElement {
  const node: FlightLazyNode = {
    $$typeof: Symbol.for("react.lazy"),
    _payload: element,
    _init: (payload) => payload,
  };
  // SAFETY: React's public types have no lazy node, though React renders one wherever it renders
  // an element, and Base UI's render prop unwraps it. Flight produces this shape.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a lazy node shares no key with ReactElement's type, so one assertion cannot reach it; this fixture stands in for React Flight's output
  return node as unknown as ReactElement;
}

describe("CommandVirtual", () => {
  it("renders a window of rows in Command.List's listbox, each placed in the full list", async () => {
    renderPalette(<VirtualPalette onRun={() => undefined} />);
    await focusInput();
    expect(listbox().getAttribute("data-slot")).toBe("command-list");
    expect(roleNamed("combobox", "Meter points").getAttribute("aria-controls")).toBe(listbox().id);
    const rows = page.getByRole("option").elements();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(60);
    expect(rows[0]?.getAttribute("aria-setsize")).toBe("1000");
    expect(rows[0]?.getAttribute("aria-posinset")).toBe("1");
  });

  it("wraps ArrowUp from the first row to the last, scrolls it into view and runs it on Enter", async () => {
    const onRun = vi.fn<(item: string) => void>();
    renderPalette(<VirtualPalette onRun={onRun} />);
    await focusInput();
    await userEvent.keyboard("{ArrowUp}");
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 1000");
    await expect.poll(() => isInView(roleNamed("option", "Meter point 1000"))).toBe(true);
    expect(roleNamed("option", "Meter point 1000").getAttribute("aria-posinset")).toBe("1000");
    await userEvent.keyboard("{Enter}");
    expect(onRun.mock.calls).toEqual([["Meter point 1000"]]);
  });

  it("runs the highlighted row on Enter after the wheel scrolls it out of view", async () => {
    const onRun = vi.fn<(item: string) => void>();
    // The wheel needs the pointer over the list, and a hovered row would take the highlight, so
    // hover leaves the keyboard's highlight alone here.
    renderPalette(<VirtualPalette onRun={onRun} highlightItemOnHover={false} />);
    const input = await focusInput();
    await highlightThirdRowAndWheelAway();
    const highlighted = roleNamed("option", "Meter point 0003");
    expect(isInView(highlighted)).toBe(false);
    expect(page.getByRole("option", { name: "Meter point 0004", exact: true }).elements()).toEqual([]);
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRun.mock.calls).toEqual([["Meter point 0003"]]);
  });

  it("scrolls back to the first match when typing moves the highlight", async () => {
    renderPalette(<VirtualPalette onRun={() => undefined} highlightItemOnHover={false} />);
    const input = await focusInput();
    await highlightThirdRowAndWheelAway();
    input.focus();
    // "point 0" matches 999 rows, so the list stays long and the first match is far above.
    await userEvent.keyboard("point 0");
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0001");
    await expect.poll(() => isInView(roleNamed("option", "Meter point 0001"))).toBe(true);
  });

  it("takes the lazy element React Flight hands over for a Server Component's render prop", async () => {
    // React Flight hands a client component this lazy wrapper in place of an element a Server
    // Component created; React's children utilities unwrap it through `_init(_payload)`.
    const serverElement = flightLazyElement(<CommandVirtual.List />);
    renderPalette(
      <Command.Root items={METER_POINTS} virtualized>
        <Command.Input aria-label="Meter points" />
        <Command.List render={serverElement}>
          {(item: string) => <Command.Item value={item}>{item}</Command.Item>}
        </Command.List>
      </Command.Root>
    );
    await focusInput();
    expect(page.getByRole("option").elements().length).toBeLessThan(60);
    expect(listbox().getAttribute("data-slot")).toBe("command-list");
  });

  it("virtualizes a page's search", async () => {
    renderPalette(
      <Command.Root defaultPages={["points"]}>
        <Command.Page id="points" label="Meter points" items={METER_POINTS} virtualized>
          <Command.Input />
          <Command.List render={<CommandVirtual.List />}>
            {(item: string) => <Command.Item value={item}>{item}</Command.Item>}
          </Command.List>
        </Command.Page>
      </Command.Root>
    );
    await focusInput();
    expect(page.getByRole("option").elements().length).toBeLessThan(60);
  });

  // Base UI counts an object with a null prototype as a group, so the search must too.
  // The `__proto__` key in a literal sets the prototype, here to null.
  const nullPrototypeGroup = { __proto__: null, items: ["Storgata 1", "Storgata 2"] };
  it.each([
    ["a plain group", { items: ["Storgata 1", "Storgata 2"] }],
    ["a null-prototype group", nullPrototypeGroup],
  ])("throws when a virtualized search's items are %s, without `grouped`", (_name, group) => {
    renderPalette(
      <CaughtError>
        <Command.Root virtualized filteredItems={[group]}>
          <Command.Input aria-label="Meter points" />
          <Command.List render={<CommandVirtual.List />}>
            {(entry: string) => <Command.Item value={entry}>{entry}</Command.Item>}
          </Command.List>
        </Command.Root>
      </CaughtError>
    );
    expect(Object.getPrototypeOf(nullPrototypeGroup)).toBeNull();
    expect(page.getByRole("listbox").elements()).toEqual([]);
    expect(caughtError()).toEqual({
      name: "CommandCompositionError",
      message:
        "Command.Root received groups of items without `grouped`. Add `grouped` beside `items`, or pass a flat list.",
    });
  });

  it.each([
    [
      "in a search without `virtualized`",
      () => (
        <Command.Root items={METER_POINTS}>
          <Command.List render={<CommandVirtual.List />}>
            {(item: string) => <Command.Item value={item}>{item}</Command.Item>}
          </Command.List>
        </Command.Root>
      ),
      "CommandVirtual.List must be used in a virtualized search. Add `virtualized` to the Command.Root or Command.Page that holds the search.",
    ],
    [
      "anywhere but Command.List's render",
      () => (
        <Command.Root items={METER_POINTS} virtualized>
          <CommandVirtual.List />
        </Command.Root>
      ),
      "CommandVirtual.List must be the render element of Command.List. Render it as <Command.List render={<CommandVirtual.List />}> with a row function as children.",
    ],
  ])("throws a named error when it is used %s", (_case, Tree, message) => {
    renderPalette(
      <CaughtError>
        <Tree />
      </CaughtError>
    );
    expect(caughtError()).toEqual({ name: "CommandCompositionError", message });
  });
});
