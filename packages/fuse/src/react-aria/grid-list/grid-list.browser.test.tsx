import type { ReactNode } from "react";

import { useDragAndDrop } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import { UiProviders } from "../ui-providers/ui-providers";
import { GridList, GridListItem } from "./grid-list";

const DRAG_COPY = {
  "nb-NO": "Dra for å endre rekkefølge",
  "en-US": "Drag to reorder",
} as const;

function renderList(node: ReactNode, locale: SupportedLocale = "en-US") {
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

describe("GridList", () => {
  it("shows row checkboxes in multiple toggle mode and toggles a row with Space", async () => {
    const onSelectionChange = vi.fn();
    renderList(
      <GridList
        aria-label="Meters"
        selectionMode="multiple"
        selectionBehavior="toggle"
        onSelectionChange={onSelectionChange}>
        <GridListItem id="oslo">Oslo</GridListItem>
        <GridListItem id="bergen">Bergen</GridListItem>
      </GridList>
    );

    expect(checkboxes()).toHaveLength(2);

    rowNamed("Oslo").focus();
    await userEvent.keyboard(" ");
    expect(selectionKeys(lastSelection(onSelectionChange.mock.calls))).toEqual(["oslo"]);
  });

  // GridListItem hands RAC a render function, so RAC cannot read a string child's text itself;
  // typeahead finds a row only through the textValue GridListItem derives.
  it("moves row focus by typeahead on a string child", async () => {
    renderList(
      <GridList aria-label="Meters">
        <GridListItem>Oslo</GridListItem>
        <GridListItem>Bergen</GridListItem>
        <GridListItem>Trondheim</GridListItem>
      </GridList>
    );

    rowNamed("Oslo").focus();
    await userEvent.keyboard("t");
    expect(document.activeElement).toBe(rowNamed("Trondheim"));
  });

  it("names the drag handle from the locale dictionary and paints the shared focus ring", async () => {
    // grid-list.test.ts pins every locale's row; one non-default locale proves the handle reads it.
    const { unmount } = renderList(<DraggableMeters />, "nb-NO");
    await expect.element(page.getByRole("button", { name: DRAG_COPY["nb-NO"], exact: true })).toBeVisible();
    unmount();

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
});
