import type { ReactElement, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CaughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Command } from "../command";
import { CommandVirtual } from "./index";

const METER_POINTS = Array.from(
  { length: 1000 },
  (_, index) => `Meter point ${String(index + 1).padStart(4, "0")}`
);

/** A group as Base UI recognizes one: an object with its own `items` array. */
type StreetGroup = { readonly items: readonly string[] };

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
    <CommandVirtual.Root items={METER_POINTS} highlightItemOnHover={highlightItemOnHover}>
      <Command.Input aria-label="Meter points" />
      <CommandVirtual.List>
        {(item: string) => (
          <Command.Item
            key={item}
            value={item}
            onClick={() => {
              onRun(item);
            }}>
            {item}
          </Command.Item>
        )}
      </CommandVirtual.List>
    </CommandVirtual.Root>
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

describe("CommandVirtual", () => {
  it("renders a window of rows, each placed in the full list", async () => {
    renderPalette(<VirtualPalette onRun={() => undefined} />);
    roleNamed("combobox", "Meter points").focus();
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0001");
    const rows = page.getByRole("option").elements();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(60);
    expect(rows[0]?.getAttribute("aria-setsize")).toBe("1000");
    expect(rows[0]?.getAttribute("aria-posinset")).toBe("1");
  });

  it("wraps ArrowUp from the first row to the last, scrolls it into view and runs it on Enter", async () => {
    const onRun = vi.fn<(item: string) => void>();
    renderPalette(<VirtualPalette onRun={onRun} />);
    roleNamed("combobox", "Meter points").focus();
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0001");
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
    roleNamed("combobox", "Meter points").focus();
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0001");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0003");
    await userEvent.wheel(listbox(), { delta: { y: 4000 } });
    await expect.poll(() => listbox().scrollTop).toBeGreaterThan(2000);
    const highlighted = roleNamed("option", "Meter point 0003");
    expect(isInView(highlighted)).toBe(false);
    expect(page.getByRole("option", { name: "Meter point 0004", exact: true }).elements()).toEqual([]);
    roleNamed("combobox", "Meter points").focus();
    await userEvent.keyboard("{Enter}");
    expect(onRun.mock.calls).toEqual([["Meter point 0003"]]);
  });

  it("scrolls back to the first match when typing moves the highlight", async () => {
    renderPalette(<VirtualPalette onRun={() => undefined} highlightItemOnHover={false} />);
    const input = roleNamed("combobox", "Meter points");
    input.focus();
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0001");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0003");
    await userEvent.wheel(listbox(), { delta: { y: 4000 } });
    await expect.poll(() => listbox().scrollTop).toBeGreaterThan(2000);
    input.focus();
    // "point 0" matches 999 rows, so the list stays long and the first match is far above.
    await userEvent.keyboard("point 0");
    await expect.poll(() => highlightedOption()?.textContent).toBe("Meter point 0001");
    await expect.poll(() => isInView(roleNamed("option", "Meter point 0001"))).toBe(true);
  });

  // Base UI counts an object with a null prototype as a group, so the list must too.
  // The `__proto__` key in a literal sets the prototype, here to null.
  const nullPrototypeGroup = { __proto__: null, items: ["Storgata 1", "Storgata 2"] };
  it.each([
    ["a plain group", { items: ["Storgata 1", "Storgata 2"] }],
    ["a null-prototype group", nullPrototypeGroup],
  ])("throws on %s and points to Command.GroupedRoot", (_name, group) => {
    renderPalette(
      <CaughtError>
        <CommandVirtual.Root filteredItems={[group]}>
          <Command.Input aria-label="Meter points" />
          <CommandVirtual.List>
            {(entry: StreetGroup) => <Command.Item value={entry}>Group</Command.Item>}
          </CommandVirtual.List>
        </CommandVirtual.Root>
      </CaughtError>
    );
    expect(Object.getPrototypeOf(nullPrototypeGroup)).toBeNull();
    expect(page.getByRole("listbox").elements()).toEqual([]);
    expect(document.body.textContent).toContain(
      "CommandVirtual.List renders a flat list of items, and these items are groups. Pass groups to Command.GroupedRoot and render them with Command.List."
    );
  });
});
