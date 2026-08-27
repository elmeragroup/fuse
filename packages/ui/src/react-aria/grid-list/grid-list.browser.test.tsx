import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { UiProviders } from "../ui-providers/ui-providers";
import { GridList, GridListItem } from "./grid-list";

const METERS = [
  { id: "oslo", name: "Oslo" },
  { id: "bergen", name: "Bergen" },
  { id: "trondheim", name: "Trondheim" },
] as const;

function renderList(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

function gridNamed(name: string): HTMLElement {
  const element = page.getByRole("grid", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected grid ${name}`);
  }
  return element;
}

function rows(): HTMLElement[] {
  return page
    .getByRole("row")
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function rowNamed(name: string | RegExp): HTMLElement {
  const element = page.getByRole("row", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected row ${String(name)}`);
  }
  return element;
}

function checkboxes(): HTMLElement[] {
  return page
    .getByRole("checkbox")
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function selectionKeys(selection: "all" | Set<unknown>): string[] {
  if (selection === "all") {
    return ["all"];
  }
  return [...selection].map(String).sort();
}

function lastSelection(calls: unknown[][]): "all" | Set<unknown> {
  const last = calls.at(-1)?.[0];
  if (last === "all") {
    return last;
  }
  if (last instanceof Set) {
    return last;
  }
  throw new Error("expected a RAC Selection");
}

function selectAllChord(): string {
  return navigator.platform.includes("Mac") ? "{Meta>}a{/Meta}" : "{Control>}a{/Control}";
}

describe("GridList", () => {
  it("renders a grid and rows from static children", async () => {
    renderList(
      <GridList aria-label="Meters">
        <GridListItem>Oslo</GridListItem>
        <GridListItem>Bergen</GridListItem>
      </GridList>
    );

    await expect.element(page.getByRole("grid", { name: "Meters" })).toBeVisible();
    expect(rows().map((row) => row.textContent)).toEqual(["Oslo", "Bergen"]);
  });

  it("renders a grid and rows from an items collection", async () => {
    renderList(
      <GridList aria-label="Meters" items={[...METERS]}>
        {(item) => <GridListItem id={item.id}>{item.name}</GridListItem>}
      </GridList>
    );

    await expect.element(page.getByRole("grid", { name: "Meters" })).toBeVisible();
    expect(rows().map((row) => row.textContent)).toEqual(["Oslo", "Bergen", "Trondheim"]);
  });

  it("shows row checkboxes in multiple toggle mode, toggles with Space, and selects all", async () => {
    const onSelectionChange = vi.fn();
    renderList(
      <GridList
        aria-label="Meters"
        selectionMode="multiple"
        selectionBehavior="toggle"
        onSelectionChange={onSelectionChange}
        disabledKeys={["trondheim"]}>
        <GridListItem id="oslo">Oslo</GridListItem>
        <GridListItem id="bergen">Bergen</GridListItem>
        <GridListItem id="trondheim">Trondheim</GridListItem>
      </GridList>
    );

    expect(checkboxes()).toHaveLength(3);

    rowNamed("Oslo").focus();
    await userEvent.keyboard(" ");
    expect(selectionKeys(lastSelection(onSelectionChange.mock.calls))).toEqual(["oslo"]);

    await userEvent.keyboard(selectAllChord());
    const allKeys = selectionKeys(lastSelection(onSelectionChange.mock.calls));
    if (allKeys[0] === "all") {
      expect(allKeys).toEqual(["all"]);
    } else {
      expect(allKeys).toEqual(["bergen", "oslo"]);
    }
  });

  it("moves row focus with arrows and typeahead", async () => {
    renderList(
      <GridList aria-label="Meters">
        <GridListItem>Oslo</GridListItem>
        <GridListItem>Bergen</GridListItem>
        <GridListItem>Trondheim</GridListItem>
      </GridList>
    );

    rowNamed("Oslo").focus();
    expect(document.activeElement).toBe(rowNamed("Oslo"));

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rowNamed("Bergen"));

    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(rowNamed("Oslo"));

    await userEvent.keyboard("t");
    expect(document.activeElement).toBe(rowNamed("Trondheim"));
  });

  it("exposes disabledKeys rows as aria-disabled and refuses selection", async () => {
    const onSelectionChange = vi.fn();
    renderList(
      <GridList
        aria-label="Meters"
        selectionMode="multiple"
        selectionBehavior="toggle"
        disabledKeys={["trondheim"]}
        onSelectionChange={onSelectionChange}>
        <GridListItem id="oslo">Oslo</GridListItem>
        <GridListItem id="trondheim">Trondheim</GridListItem>
      </GridList>
    );

    const disabled = rowNamed("Trondheim");
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled.hasAttribute("data-disabled")).toBe(true);
    expect(
      checkboxes().some((box) => box.getAttribute("aria-disabled") === "true" || box.hasAttribute("disabled"))
    ).toBe(true);

    disabled.focus();
    await userEvent.keyboard(" ");
    disabled.click();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(disabled.getAttribute("aria-selected")).not.toBe("true");
  });

  it("centers renderEmptyState when the collection is empty", async () => {
    renderList(
      <GridList
        aria-label="Meters"
        className="min-h-40"
        items={[]}
        renderEmptyState={() => "No meters match this filter."}>
        {() => <GridListItem>unused</GridListItem>}
      </GridList>
    );

    const grid = gridNamed("Meters");
    expect(grid).toHaveAttribute("data-empty");
    expect(grid.querySelectorAll('[data-slot="grid-list-item"]')).toHaveLength(0);
    await expect.element(page.getByText("No meters match this filter.")).toBeVisible();
    expect(getComputedStyle(grid).display).toBe("flex");
    expect(getComputedStyle(grid).alignItems).toBe("center");
    expect(getComputedStyle(grid).justifyContent).toBe("center");
  });
});
