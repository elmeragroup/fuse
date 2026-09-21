import type { ReactNode } from "react";

import { useDragAndDrop } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { CONTROL_SM, px, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { UiProviders } from "../ui-providers/ui-providers";
import { GridList, GridListItem } from "./grid-list";

const METERS = [
  { id: "oslo", name: "Oslo" },
  { id: "bergen", name: "Bergen" },
  { id: "trondheim", name: "Trondheim" },
] as const;

const DRAG_COPY = {
  "nb-NO": "Dra for å endre rekkefølge",
  "sv-SE": "Dra för att ändra ordning",
  "en-US": "Drag to reorder",
  "fi-FI": "Vedä järjestääksesi",
} as const;

function renderList(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(
    <UiProviders locale={locale} navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

function DraggableMeters({
  keyboardNavigationBehavior,
}: {
  keyboardNavigationBehavior?: "arrow" | "tab";
} = {}) {
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
  });
  return (
    <GridList
      aria-label="Meters"
      dragAndDropHooks={dragAndDropHooks}
      keyboardNavigationBehavior={keyboardNavigationBehavior}>
      <GridListItem id="oslo">Oslo</GridListItem>
    </GridList>
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
    expect(page.getByRole("row", { name: "Oslo" }).query()).toBeNull();
    await expect.element(page.getByText("No meters match this filter.")).toBeVisible();
    expect(getComputedStyle(grid).display).toBe("flex");
    expect(getComputedStyle(grid).alignItems).toBe("center");
    expect(getComputedStyle(grid).justifyContent).toBe("center");
  });

  it("names the drag handle in every locale and paints the shared focus ring", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderList(<DraggableMeters />, locale);
      const handle = page.getByRole("button", { name: DRAG_COPY[locale], exact: true }).element();
      if (!(handle instanceof HTMLElement)) {
        throw new Error(`expected drag handle in ${locale}`);
      }
      unmount();
    }

    // Default GridList Tab exits the collection (keyboardNavigationBehavior="arrow").
    // "tab" lets Tab from the row land on the slot="drag" handle so the shared
    // helper can probe :focus-visible / mouse-absence.
    renderList(<DraggableMeters keyboardNavigationBehavior="tab" />);
    const handle = page.getByRole("button", { name: DRAG_COPY["en-US"], exact: true }).element();
    if (!(handle instanceof HTMLElement)) {
      throw new Error("expected the drag handle");
    }
    await assertFocusRingAtBothDensities(rowNamed("Oslo"), handle);
  });

  it("keeps the drag handle on the signed sm rung and row padding density-independent", () => {
    renderList(<DraggableMeters />);
    const handle = roleNamed("button", DRAG_COPY["en-US"]);
    const rowPadding = new Set<string>();

    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      // The handle is the package-private RAC Button at `icon-sm`.
      expect(px(getComputedStyle(handle).height)).toBe(CONTROL_SM[density].height);
      const row = getComputedStyle(rowNamed("Oslo"));
      rowPadding.add(`${row.paddingBlockStart}/${row.paddingInlineStart}`);
    }

    // row padding and gap are not a control-box rung, so they read no
    // `--control-*` variable and stay identical across both stamps.
    expect(rowPadding.size).toBe(1);
  });
});
