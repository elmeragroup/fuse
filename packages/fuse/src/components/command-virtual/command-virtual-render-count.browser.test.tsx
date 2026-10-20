import type { ReactElement } from "react";

import { beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

/**
 * Browser project. Render counts of virtual rows: a probe inside each row records its renders, and
 * the expectation is which rows a scroll has to render.
 */
import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Command } from "../command";
import { CommandVirtual } from "./index";

const ITEMS = Array.from({ length: 1000 }, (_, index) => `Meter point ${String(index + 1).padStart(4, "0")}`);

/** Renders per item since the last reset. */
const renders = new Map<string, number>();

function Probe({ item }: { readonly item: string }): ReactElement {
  renders.set(item, (renders.get(item) ?? 0) + 1);
  return <span>{item}</span>;
}

function Palette(): ReactElement {
  return (
    <Command.Root items={ITEMS} virtualized>
      <Command.Input aria-label="Meter points" />
      <Command.List render={<CommandVirtual.List />}>
        {(item: string) => (
          <Command.Item value={item}>
            <Probe item={item} />
          </Command.Item>
        )}
      </Command.List>
    </Command.Root>
  );
}

function shownItems(): string[] {
  return page
    .getByRole("option")
    .elements()
    .map((option) => option.textContent);
}

async function nextFrames(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

describe("CommandVirtual row renders", () => {
  beforeEach(() => {
    renders.clear();
  });

  it("renders only the rows a scroll brings into the window", async () => {
    renderThemed(withLocale("en-US", <Palette />));
    roleNamed("combobox", "Meter points").focus();
    await expect.poll(() => shownItems().length).toBeGreaterThan(3);
    await nextFrames();
    const list = page.getByRole("listbox").element();
    const rowHeight = page.getByRole("option").elements()[0]?.getBoundingClientRect().height ?? 0;
    const before = shownItems();

    renders.clear();
    list.scrollTop += rowHeight * 3;
    await expect.poll(() => shownItems().some((item) => !before.includes(item))).toBe(true);
    await nextFrames();

    const after = shownItems();
    const kept = before.filter((item) => after.includes(item));
    expect(kept.length).toBeGreaterThan(0);
    // A row that stays in the window keeps its render; only the rows that entered render.
    expect(kept.filter((item) => renders.has(item))).toEqual([]);
    const entered = after.filter((item) => !before.includes(item));
    expect([...renders.keys()].toSorted()).toEqual(entered.toSorted());
  });
});
