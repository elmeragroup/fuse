import { useRef, useState } from "react";
import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
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

async function openWithClick(name = "Fruit"): Promise<HTMLElement> {
  await userEvent.click(comboboxNamed(name));
  return listboxNamed();
}

async function openWithArrowDown(name = "Fruit"): Promise<HTMLElement> {
  const trigger = comboboxNamed(name);
  trigger.focus();
  await userEvent.keyboard("{ArrowDown}");
  return listboxNamed();
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

  it("opens from ArrowDown on the trigger", async () => {
    renderThemed(<FruitSelect />);
    await openWithArrowDown();
    expect(highlightedOption().textContent).toContain("Apple");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderThemed(<FruitSelect />);
    const trigger = comboboxNamed("Fruit");
    await openWithClick();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
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

  it("dims disabled items and does not select them", async () => {
    // Primitive navigation: arrows may highlight a disabled option; Enter does not select.
    const onValueChange = vi.fn();
    renderThemed(<FruitSelect onValueChange={onValueChange} extra />);
    await openWithArrowDown();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowDown}");
    const cherry = optionNamed("Cherry");
    expect(cherry.getAttribute("data-disabled")).not.toBeNull();
    expect(highlightedOption()).toBe(cherry);
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(page.getByRole("listbox").query()).not.toBeNull();
  });

  it("jumps to a matching option on typeahead while open", async () => {
    renderThemed(<FruitSelect />);
    await openWithArrowDown();
    await userEvent.keyboard("d");
    expect(highlightedOption().textContent).toContain("Date");
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
    await userEvent.click(comboboxNamed("Aligned"));
    expect(selectContent().getAttribute("data-align-trigger")).toBe("true");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    await userEvent.click(comboboxNamed("Unaligned"));
    expect(selectContent().getAttribute("data-align-trigger")).toBe("false");
  });

  it("surfaces aria-invalid on the trigger and disables it from Root", () => {
    renderThemed(
      <>
        <Select.Root>
          <Select.Trigger aria-invalid aria-label="Invalid fruit">
            <Select.Value placeholder="Pick a fruit" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root disabled>
          <Select.Trigger aria-label="Disabled fruit">
            <Select.Value placeholder="Pick a fruit" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select.Root>
      </>
    );
    expect(comboboxNamed("Invalid fruit").getAttribute("aria-invalid")).toBe("true");
    expect(comboboxNamed("Disabled fruit")).toHaveProperty("disabled", true);
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
    expect(page.getByRole("group", { name: "Citrus", exact: true }).element()).toBeTruthy();
  });

  it("portals Content into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(<FruitSelect />);
    const scope = host.querySelector("[data-theme-brand]");
    const listbox = await openWithClick();
    expect(scope).not.toBeNull();
    expect(scope?.contains(listbox)).toBe(true);
    expect([...document.body.children].includes(listbox)).toBe(false);
  });

  it("portals Content into an explicit container element", () => {
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
    const listbox = listboxNamed();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(listbox)).toBe(true);
    expect([...document.body.children].includes(listbox)).toBe(false);
  });

  it("waits while the resolved Content container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <Select.Root open>
          <Select.Trigger aria-label="Pending">
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content container={ref}>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select.Root>
      );
    }
    renderThemed(<NeverAttached />);
    expect(page.getByRole("listbox").query()).toBeNull();
  });

  it("does not paint the popup outside a ThemeScope element that has not attached yet", () => {
    renderThemed(
      <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
        <Select.Root open>
          <Select.Trigger aria-label="Scoped">
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select.Root>
      </ThemeScope>
    );
    const listbox = listboxNamed();
    const scope = listbox.closest("[data-theme-variant=external]");
    expect(scope).not.toBeNull();
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
