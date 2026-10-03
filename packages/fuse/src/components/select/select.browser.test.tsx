import { useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { render } from "../../../test/browser-render";
import { fkasPrivate, renderThemed } from "../../../test/themed-browser-render";
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
  extra,
}: {
  onValueChange?: ComponentProps<typeof Select.Root>["onValueChange"];
  onOpenChange?: ComponentProps<typeof Select.Root>["onOpenChange"];
  disabled?: boolean;
  size?: "sm" | "default";
  alignItemWithTrigger?: boolean;
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
      <Select.Content alignItemWithTrigger={alignItemWithTrigger}>
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

// The popup mounts after the opening event settles, so both openers wait for the listbox.
async function openedListbox(): Promise<HTMLElement> {
  await expect.element(page.getByRole("listbox")).toBeInTheDocument();
  return listboxNamed();
}

async function openWithClick(name = "Fruit"): Promise<HTMLElement> {
  await userEvent.click(comboboxNamed(name));
  return openedListbox();
}

async function openWithArrowDown(name = "Fruit"): Promise<HTMLElement> {
  comboboxNamed(name).focus();
  await userEvent.keyboard("{ArrowDown}");
  const listbox = await openedListbox();
  // Keyboard opening highlights an option once the list has registered its items.
  await vi.waitFor(() => highlightedOption());
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

  describe("placement against the fixed containing block", () => {
    // The scope sits away from the viewport origin, so a popup placed with viewport
    // coordinates inside a transformed block lands that offset away from its trigger.
    function OffsetScope({ ancestor }: { ancestor: CSSProperties }) {
      return (
        <div style={{ ...ancestor, marginTop: 160, marginLeft: 120 }}>
          <ThemeScope theme={fkasPrivate}>
            <FruitSelect />
          </ThemeScope>
        </div>
      );
    }

    // A misplaced popup can scroll the page, and the scroll outlives its test.
    beforeEach(() => {
      window.scrollTo(0, 0);
    });

    async function openedContentAndTrigger(): Promise<{ content: DOMRect; trigger: DOMRect }> {
      await openWithClick();
      // The entrance slide shifts the popup until it settles in place.
      await vi.waitFor(() => {
        expect(selectContent().getAnimations()).toHaveLength(0);
      });
      return {
        content: selectContent().getBoundingClientRect(),
        trigger: comboboxNamed("Fruit").getBoundingClientRect(),
      };
    }

    // Ancestors that make themselves the containing block for `position: fixed` content.
    it.each([
      ["a transformed", { transform: "translateZ(0)" }],
      ["a content-visibility: auto", { contentVisibility: "auto" }],
    ] satisfies [string, CSSProperties][])(
      "opens below its trigger when %s ancestor contains the popup",
      async (_, ancestor) => {
        render(<OffsetScope ancestor={ancestor} />);
        const { content, trigger } = await openedContentAndTrigger();

        // Oracle: the default `side="bottom"` and `sideOffset={4}` place the popup's top 4px
        // under the trigger, overlapping it horizontally.
        expect(content.top - trigger.bottom).toBeGreaterThanOrEqual(0);
        expect(content.top - trigger.bottom).toBeLessThanOrEqual(8);
        expect(content.left).toBeLessThan(trigger.right);
        expect(content.right).toBeGreaterThan(trigger.left);
        expect(selectContent().getAttribute("data-align-trigger")).toBe("false");
      }
    );

    // Ancestors that leave the viewport as the containing block, as a fixed probe measures them
    // in the test browser.
    it.each([
      ["a plain", {}],
      ["a container-type: inline-size", { containerType: "inline-size" }],
    ] satisfies [string, CSSProperties][])(
      "keeps item alignment when %s ancestor leaves the viewport containing the popup",
      async (_, ancestor) => {
        render(<OffsetScope ancestor={ancestor} />);
        const { content, trigger } = await openedContentAndTrigger();

        // Item alignment lays the popup over the trigger instead of under it.
        expect(content.top).toBeLessThan(trigger.bottom);
        expect(content.bottom).toBeGreaterThan(trigger.top);
        expect(selectContent().getAttribute("data-align-trigger")).toBe("true");
      }
    );

    it("opens below its trigger when a shorter transformed ancestor sits at the viewport origin", async () => {
      // A long list makes Base UI's item alignment pin the positioner with `bottom: 0`, which
      // resolves against this 200px block rather than the viewport.
      const values = Array.from({ length: 40 }, (_, index) => `item-${index}`);
      render(
        <div
          style={{ position: "fixed", top: 0, left: 0, height: 200, width: 320, transform: "translateZ(0)" }}>
          <div style={{ paddingTop: 60, paddingLeft: 40 }}>
            <ThemeScope theme={fkasPrivate}>
              <Select.Root>
                <Select.Trigger aria-label="Fruit">
                  <Select.Value placeholder="Pick an item" />
                </Select.Trigger>
                <Select.Content>
                  {values.map((value) => (
                    <Select.Item key={value} value={value}>
                      {value}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </ThemeScope>
          </div>
        </div>
      );
      const { content, trigger } = await openedContentAndTrigger();

      // Oracle: the default `side="bottom"` and `sideOffset={4}` place the popup's top 4px
      // under the trigger.
      expect(content.top - trigger.bottom).toBeGreaterThanOrEqual(0);
      expect(content.top - trigger.bottom).toBeLessThanOrEqual(8);
      expect(selectContent().getAttribute("data-align-trigger")).toBe("false");
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
});
