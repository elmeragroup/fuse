import { useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { render } from "../../../test/browser-render";
import { expectFocusInsideFill, expectStateFill } from "../../../test/forced-highlight";
import { withForcedColors } from "../../../test/media-emulation";
import { differsFromCanvas, finishPopupEntrance } from "../../../test/screenshot-pixels";
import { cssVarColor, fkasPrivate, renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Select } from "./index";

function comboboxNamed(name?: string): HTMLElement {
  const locator =
    name === undefined ? page.getByRole("combobox") : page.getByRole("combobox", { name, exact: true });
  const element = locator.element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(name === undefined ? "expected a combobox" : `expected combobox ${name}`);
  }
  return element;
}

function listboxNamed(): HTMLElement {
  const element = page.getByRole("listbox").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a listbox");
  }
  return element;
}

function selectContent(): HTMLElement {
  const listbox = listboxNamed();
  const content = listbox.parentElement;
  if (!(content instanceof HTMLElement)) {
    throw new Error("expected select content around the listbox");
  }
  return content;
}

function optionNamed(name: string): HTMLElement {
  const element = page.getByRole("option", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected option ${name}`);
  }
  return element;
}

function highlightedOption(): HTMLElement {
  const element = page
    .getByRole("option")
    .elements()
    .find((option) => option.hasAttribute("data-highlighted"));
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a highlighted option");
  }
  return element;
}

const FRUIT_ITEMS = {
  apple: "Apple",
  banana: "Banana",
  cherry: "Cherry",
  date: "Date",
} as const;

function FruitSelect({
  onValueChange,
  onOpenChange,
  disabled,
  size,
  alignItemWithTrigger,
  sideOffset,
  extra,
}: {
  onValueChange?: ComponentProps<typeof Select.Root>["onValueChange"];
  onOpenChange?: ComponentProps<typeof Select.Root>["onOpenChange"];
  disabled?: boolean;
  size?: "sm" | "default";
  alignItemWithTrigger?: boolean;
  sideOffset?: number;
  extra?: boolean;
}) {
  return (
    <Select.Root
      items={FRUIT_ITEMS}
      disabled={disabled}
      onValueChange={onValueChange}
      onOpenChange={onOpenChange}>
      <Select.Trigger size={size} aria-label="Fruit">
        <Select.Value placeholder="Pick a fruit" />
      </Select.Trigger>
      <Select.Content alignItemWithTrigger={alignItemWithTrigger} sideOffset={sideOffset}>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="banana">Banana</Select.Item>
        {extra ? (
          <Select.Item value="cherry" disabled>
            Cherry
          </Select.Item>
        ) : null}
        <Select.Item value="date">Date</Select.Item>
      </Select.Content>
    </Select.Root>
  );
}

// The popup mounts after the opening event settles, so both openers wait for the listbox and for
// the popup's entrance.
async function openedListbox(): Promise<HTMLElement> {
  await expect.element(page.getByRole("listbox")).toBeInTheDocument();
  const listbox = listboxNamed();
  await finishPopupEntrance(listbox);
  return listbox;
}

async function openWithClick(name = "Fruit"): Promise<HTMLElement> {
  await userEvent.click(comboboxNamed(name));
  return openedListbox();
}

async function openWithArrowDown(name = "Fruit"): Promise<HTMLElement> {
  comboboxNamed(name).focus();
  await userEvent.keyboard("{ArrowDown}");
  const listbox = await openedListbox();
  // Keyboard opening highlights an option once the list has registered its items, and focuses it
  // a frame later. A key sent before that focus reaches the trigger, which drops it.
  await vi.waitFor(() => expect(document.activeElement).toBe(highlightedOption()));
  return listbox;
}

describe("Select", () => {
  it("opens from the trigger click and exposes a listbox", async () => {
    const onOpenChange = vi.fn();
    renderThemed(<FruitSelect onOpenChange={onOpenChange} />);

    await openWithClick();
    const content = selectContent();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(content.getAttribute("data-slot")).toBe("select-content");
    expect(optionNamed("Apple")).toBeTruthy();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderThemed(<FruitSelect />);
    await openWithClick();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    await expect.element(page.getByRole("combobox", { name: "Fruit", exact: true })).toHaveFocus();
  });

  it("selects via click, closes, and updates the trigger value", async () => {
    const onValueChange = vi.fn();
    renderThemed(<FruitSelect onValueChange={onValueChange} />);
    await openWithClick();
    await userEvent.click(optionNamed("Banana"));
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
    expect(comboboxNamed("Fruit").textContent).toContain("Banana");
  });

  it("moves highlight with arrows, selects with Enter, and honors Home/End", async () => {
    const onValueChange = vi.fn();
    renderThemed(<FruitSelect onValueChange={onValueChange} extra />);
    await openWithArrowDown();
    expect(highlightedOption().textContent).toContain("Apple");

    await userEvent.keyboard("{ArrowDown}");
    expect(highlightedOption().textContent).toContain("Banana");

    await userEvent.keyboard("{ArrowUp}");
    expect(highlightedOption().textContent).toContain("Apple");

    await userEvent.keyboard("{End}");
    expect(highlightedOption().textContent).toContain("Date");

    await userEvent.keyboard("{Home}");
    expect(highlightedOption().textContent).toContain("Apple");

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
  });

  it("changes the value from a closed trigger via typeahead without opening", async () => {
    const onValueChange = vi.fn();
    renderThemed(<FruitSelect onValueChange={onValueChange} />);
    const trigger = comboboxNamed("Fruit");
    trigger.focus();
    await userEvent.keyboard("b");
    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
    expect(page.getByRole("listbox").query()).toBeNull();
    expect(trigger.textContent).toContain("Banana");
  });

  it("emits data-size for both trigger sizes", () => {
    renderThemed(
      <>
        <Select.Root>
          <Select.Trigger aria-label="Default size">
            <Select.Value placeholder="Default" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root>
          <Select.Trigger size="sm" aria-label="Small size">
            <Select.Value placeholder="Small" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
      </>
    );
    expect(comboboxNamed("Default size").getAttribute("data-size")).toBe("default");
    expect(comboboxNamed("Small size").getAttribute("data-size")).toBe("sm");
  });

  it("emits data-align-trigger from alignItemWithTrigger", async () => {
    renderThemed(
      <>
        <Select.Root>
          <Select.Trigger aria-label="Aligned">
            <Select.Value placeholder="Aligned" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root>
          <Select.Trigger aria-label="Unaligned">
            <Select.Value placeholder="Unaligned" />
          </Select.Trigger>
          <Select.Content alignItemWithTrigger={false}>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
      </>
    );
    await openWithClick("Aligned");
    expect(selectContent().getAttribute("data-align-trigger")).toBe("true");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    await openWithClick("Unaligned");
    expect(selectContent().getAttribute("data-align-trigger")).toBe("false");
  });

  describe("placement", () => {
    // The scope sits away from the viewport origin, so a popup placed with viewport
    // coordinates inside a transformed block would land that offset away from its trigger.
    function OffsetScope({
      ancestor,
      alignItemWithTrigger,
      sideOffset,
    }: {
      ancestor: CSSProperties;
      alignItemWithTrigger?: boolean;
      sideOffset?: number;
    }) {
      return (
        <div style={{ ...ancestor, marginTop: 160, marginLeft: 120 }}>
          <ThemeScope theme={fkasPrivate}>
            <FruitSelect alignItemWithTrigger={alignItemWithTrigger} sideOffset={sideOffset} />
          </ThemeScope>
        </div>
      );
    }

    // A misplaced popup can scroll the page, and the scroll outlives its test.
    beforeEach(() => {
      window.scrollTo(0, 0);
    });

    async function openedContentAndTrigger(): Promise<{ content: DOMRect; trigger: DOMRect }> {
      // The entrance slide shifts the popup until it settles in place, and the opener finishes it.
      await openWithClick();
      return {
        content: selectContent().getBoundingClientRect(),
        trigger: comboboxNamed("Fruit").getBoundingClientRect(),
      };
    }

    it("lays the popup over its trigger by default on a plain page", async () => {
      render(<OffsetScope ancestor={{}} />);
      const { content, trigger } = await openedContentAndTrigger();

      // Item alignment overlays the selected row on the trigger instead of opening below it.
      expect(content.top).toBeLessThan(trigger.bottom);
      expect(content.bottom).toBeGreaterThan(trigger.top);
    });

    it("opens below its trigger inside a transformed scope with alignItemWithTrigger={false}", async () => {
      // Not the component's default of 4, so a popup that ignored the prop would sit 4px off.
      const sideOffset = 12;
      render(
        <OffsetScope
          ancestor={{ transform: "translateZ(0)" }}
          alignItemWithTrigger={false}
          sideOffset={sideOffset}
        />
      );
      const { content, trigger } = await openedContentAndTrigger();

      // Oracle: the default `side="bottom"` and the `sideOffset` passed in place the popup's top
      // that far under the trigger, overlapping it horizontally.
      expect(content.top - trigger.bottom).toBeCloseTo(sideOffset, 0);
      expect(content.left).toBeLessThan(trigger.right);
      expect(content.right).toBeGreaterThan(trigger.left);
    });
  });

  it("names a group from Select.Label", async () => {
    renderThemed(
      <Select.Root>
        <Select.Trigger aria-label="Grouped">
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            <Select.Label>Citrus</Select.Label>
            <Select.Item value="lemon">Lemon</Select.Item>
          </Select.Group>
        </Select.Content>
      </Select.Root>
    );
    await openWithClick("Grouped");
    await expect.element(page.getByRole("group", { name: "Citrus", exact: true })).toBeInTheDocument();
  });

  it("portals Content into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(<FruitSelect />);
    const scope = host.querySelector("[data-theme-brand]");
    const listbox = await openWithClick();
    expect(scope).not.toBeNull();
    expect(scope?.contains(listbox)).toBe(true);
    expect([...document.body.children].includes(listbox)).toBe(false);
  });

  it("portals Content into an explicit container element", async () => {
    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? (
            <Select.Root defaultOpen>
              <Select.Trigger aria-label="Island">
                <Select.Value placeholder="Pick" />
              </Select.Trigger>
              <Select.Content container={node}>
                <Select.Item value="apple">Apple</Select.Item>
              </Select.Content>
            </Select.Root>
          ) : null}
        </>
      );
    }
    renderThemed(<ExplicitContainer />);
    const listbox = await openedListbox();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(listbox)).toBe(true);
    expect([...document.body.children].includes(listbox)).toBe(false);
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <FruitSelect />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const trigger = comboboxNamed("Fruit");
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });

  it("fills a read-only trigger with the muted read-only fill and leaves a disabled one its card fill", () => {
    function FillProbe({
      name,
      readOnly,
      disabled,
    }: {
      name: string;
      readOnly?: boolean;
      disabled?: boolean;
    }) {
      return (
        <Select.Root readOnly={readOnly} disabled={disabled}>
          <Select.Trigger aria-label={name}>
            <Select.Value placeholder={name} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
      );
    }
    renderThemed(
      <>
        <FillProbe name="Editable" />
        <FillProbe name="Read-only" readOnly />
        <FillProbe name="Disabled read-only" readOnly disabled />
        {/* A disabled fieldset disables the trigger natively, with no data-disabled. */}
        <fieldset disabled>
          <FillProbe name="Fieldset-disabled read-only" readOnly />
        </fieldset>
      </>
    );
    const fill = (name: string) => getComputedStyle(comboboxNamed(name)).backgroundColor;
    expect(fill("Editable")).toBe(cssVarColor(comboboxNamed("Editable"), "--card"));
    expect(fill("Read-only")).toBe(cssVarColor(comboboxNamed("Read-only"), "--muted"));
    expect(fill("Disabled read-only")).toBe(cssVarColor(comboboxNamed("Disabled read-only"), "--card"));
    const inherited = comboboxNamed("Fieldset-disabled read-only");
    expect(inherited.matches(":disabled")).toBe(true);
    expect(inherited).not.toHaveAttribute("data-disabled");
    expect(fill("Fieldset-disabled read-only")).toBe(cssVarColor(inherited, "--card"));
  });
});

describe("Select highlighted option in forced-colors mode", () => {
  it("fills the option the keyboard highlights, apart from its neighbor", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<FruitSelect />);
      await openWithArrowDown();
      expect(highlightedOption()).toBe(optionNamed("Apple"));
      await expectStateFill(optionNamed("Apple"), optionNamed("Banana"), "keyboard-highlighted option");
      await expectFocusInsideFill(optionNamed("Apple"), "keyboard-highlighted option focus outline");
    });
  });

  it("fills the option the pointer highlights in a menu opened by a click, apart from its neighbor", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<FruitSelect />);
      await openWithClick();
      await userEvent.hover(optionNamed("Banana"));
      await vi.waitFor(() => expect(highlightedOption()).toBe(optionNamed("Banana")));
      await expectStateFill(optionNamed("Banana"), optionNamed("Date"), "pointer-highlighted option");
    });
  });

  it("outlines the focused option while the pointer on the scroll arrow clears its highlight", async () => {
    await withForcedColors("active", async () => {
      // The trigger sits mid-page, so the popup aligns its item with the trigger and its list
      // scrolls under a scroll arrow. Twenty rows overflow the popup by less than the tenth row's
      // offset, so that row stays in view once the arrow scrolls the list to its end.
      const fruits = Array.from({ length: 20 }, (_, index) => `Fruit ${String(index + 1)}`);
      renderThemed(
        <div style={{ paddingTop: 400 }}>
          <Select.Root>
            <Select.Trigger aria-label="Fruit">
              <Select.Value placeholder="Pick a fruit" />
            </Select.Trigger>
            <Select.Content>
              {fruits.map((fruit) => (
                <Select.Item key={fruit} value={fruit}>
                  {fruit}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      );
      await openWithArrowDown();
      await userEvent.keyboard("{ArrowDown>9/}");
      const row = optionNamed("Fruit 10");
      await vi.waitFor(() => expect(document.activeElement).toBe(row));
      const arrow = await vi.waitUntil(() =>
        document.querySelector<HTMLElement>("[data-slot=select-scroll-down-button]")
      );
      // Base UI's arrow acts on a mouse move with movement. The first move onto the page reports
      // none, so the pointer moves to the backdrop first.
      await userEvent.hover(document.body);
      await userEvent.hover(arrow);
      await vi.waitFor(() => expect(arrow.isConnected).toBe(false));
      expect(row.hasAttribute("data-highlighted")).toBe(false);
      expect(row.matches(":focus-visible")).toBe(true);
      for (const animation of document.getAnimations()) animation.finish();
      // One pixel 3px in from the left and top edges of the focused row, where a 2px outline 2px
      // in paints, beside the text. The same pixels of the next row show the popup's Canvas.
      const inset = (option: HTMLElement): DOMRect[] => {
        const box = option.getBoundingClientRect();
        return [
          new DOMRect(box.left + 3, box.top + box.height / 2, 1, 1),
          new DOMRect(box.right - 10, box.top + 3, 1, 1),
        ];
      };
      expect(
        await differsFromCanvas(selectContent(), [...inset(row), ...inset(optionNamed("Fruit 11"))])
      ).toEqual([true, true, false, false]);
    });
  });

  it("draws no box around an option it does not highlight", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<FruitSelect />);
      await openWithArrowDown();
      for (const animation of document.getAnimations()) animation.finish();
      const date = optionNamed("Date").getBoundingClientRect();
      const apple = optionNamed("Apple").getBoundingClientRect();
      // A pixel 3px above the row, where a 2px outline 2px out would paint, over the empty end of
      // the row above it. The empty end of the highlighted row shows the popup paints at all.
      const above = new DOMRect(date.right - 10, date.top - 3, 1, 1);
      const highlighted = new DOMRect(apple.right - 10, apple.top + apple.height / 2, 1, 1);
      expect(await differsFromCanvas(selectContent(), [above, highlighted])).toEqual([false, true]);
    });
  });
});
