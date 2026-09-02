import { useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  assertWithinKeyboardFocusRingAtBothDensities,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { Field } from "../field/field";
import { InputGroup } from "../input-group/input-group";
import { Combobox, useComboboxAnchor } from "./combobox";

const FRUITS = ["Apple", "Banana", "Cherry", "Date"] as const;

const EMPTY_COPY = {
  "nb-NO": "Ingen resultater.",
  "sv-SE": "Inga resultat.",
  "en-US": "No results.",
  "fi-FI": "Ei tuloksia.",
} as const;

const CLEAR_COPY = {
  "nb-NO": "Tøm valg",
  "sv-SE": "Rensa val",
  "en-US": "Clear selection",
  "fi-FI": "Tyhjennä valinta",
} as const;

const REMOVE_APPLE_COPY = {
  "nb-NO": "Fjern Apple",
  "sv-SE": "Ta bort Apple",
  "en-US": "Remove Apple",
  "fi-FI": "Poista Apple",
} as const;

const TOGGLE_COPY = {
  "nb-NO": "Vis eller skjul alternativer",
  "sv-SE": "Visa eller dölj alternativ",
  "en-US": "Toggle options",
  "fi-FI": "Näytä tai piilota vaihtoehdot",
} as const;

function renderCombobox(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function comboboxNamed(name?: string): HTMLInputElement {
  const locator =
    name === undefined ? page.getByRole("combobox") : page.getByRole("combobox", { name, exact: true });
  const element = locator.element();
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(name === undefined ? "expected a combobox input" : `expected combobox ${name}`);
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

function comboboxContent(): HTMLElement {
  const content = listboxNamed().closest("[data-slot=combobox-content]");
  if (!(content instanceof HTMLElement)) {
    throw new Error("expected combobox content around the listbox");
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
  const element = document.querySelector('[role="option"][data-highlighted]');
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a highlighted option");
  }
  return element;
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

function inputGroupRoot(): HTMLElement {
  const element = document.querySelector("[data-slot=input-group]");
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected an input-group root");
  }
  return element;
}

function FruitCombobox({
  onValueChange,
  showClear = false,
  showTrigger = true,
  disabled,
  clearLabel,
  empty,
}: {
  onValueChange?: ComponentProps<typeof Combobox.Root>["onValueChange"];
  showClear?: boolean;
  showTrigger?: boolean;
  disabled?: boolean;
  clearLabel?: string;
  empty?: ReactNode;
}) {
  return (
    <Combobox.Root items={[...FRUITS]} onValueChange={onValueChange}>
      <Combobox.Input
        aria-label="Fruit"
        placeholder="Search fruit"
        showClear={showClear}
        showTrigger={showTrigger}
        disabled={disabled}
        clearLabel={clearLabel}
      />
      <Combobox.Content>
        <Combobox.Empty>{empty}</Combobox.Empty>
        <Combobox.List>
          <Combobox.Collection>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.Collection>
        </Combobox.List>
      </Combobox.Content>
    </Combobox.Root>
  );
}

async function openWithClick(name = "Fruit"): Promise<HTMLElement> {
  await userEvent.click(comboboxNamed(name));
  return listboxNamed();
}

async function openWithArrowDown(name = "Fruit"): Promise<HTMLElement> {
  const input = comboboxNamed(name);
  input.focus();
  await userEvent.keyboard("{ArrowDown}");
  return listboxNamed();
}

describe("Combobox", () => {
  it("opens from the input click and exposes a listbox of options", async () => {
    renderCombobox(<FruitCombobox />);
    await openWithClick();
    const content = comboboxContent();
    expect(content.getAttribute("data-slot")).toBe("combobox-content");
    expect(content.getAttribute("data-chips")).toBe("false");
    expect(optionNamed("Apple")).toBeTruthy();
    expect(optionNamed("Banana")).toBeTruthy();
  });

  it("opens from ArrowDown on the input", async () => {
    renderCombobox(<FruitCombobox />);
    await openWithArrowDown();
    expect(highlightedOption().textContent).toContain("Apple");
  });

  it("filters options as the user types and shows Empty when nothing matches", async () => {
    renderCombobox(<FruitCombobox />);
    const input = comboboxNamed("Fruit");
    await userEvent.fill(input, "Ban");
    await vi.waitFor(() => {
      expect(page.getByRole("option", { name: "Banana", exact: true }).query()).not.toBeNull();
    });
    expect(page.getByRole("option", { name: "Apple", exact: true }).query()).toBeNull();
    expect(page.getByText("No results.", { exact: true }).query()).toBeNull();

    await userEvent.fill(input, "zzzz");
    await vi.waitFor(() => {
      expect(page.getByText("No results.", { exact: true }).query()).not.toBeNull();
    });
    expect(page.getByRole("option").query()).toBeNull();

    await userEvent.fill(input, "Apple");
    await vi.waitFor(() => {
      expect(page.getByText("No results.", { exact: true }).query()).toBeNull();
    });
    expect(optionNamed("Apple")).toBeTruthy();
  });

  it("selects with ArrowDown + Enter, closes, fills the input, and fires onValueChange", async () => {
    const onValueChange = vi.fn();
    renderCombobox(<FruitCombobox onValueChange={onValueChange} />);
    await openWithArrowDown();
    await userEvent.keyboard("{ArrowDown}");
    expect(highlightedOption().textContent).toContain("Banana");
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("Banana");
    expect(comboboxNamed("Fruit").value).toBe("Banana");
  });

  it("opens and closes from the trigger button and rotates the caret via data-popup-open", async () => {
    renderCombobox(<FruitCombobox />);
    const trigger = page.getByRole("button", { name: TOGGLE_COPY["en-US"], exact: true }).element();
    if (!(trigger instanceof HTMLElement)) {
      throw new Error("expected a trigger button");
    }
    expect(trigger.closest("[data-popup-open]")).toBeNull();
    await userEvent.click(trigger);
    expect(listboxNamed()).toBeTruthy();
    expect(trigger.closest("[data-popup-open]"), "trigger ancestry emits data-popup-open").not.toBeNull();
    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
  });

  it("clears the value with Combobox.Clear, hides the trigger while Clear is present, and returns focus", async () => {
    const onValueChange = vi.fn();
    renderCombobox(<FruitCombobox onValueChange={onValueChange} showClear showTrigger />);
    expect(page.getByRole("button", { name: /clear/i }).query()).toBeNull();
    expect(page.getByRole("button").query()).not.toBeNull();

    await openWithArrowDown();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    const clear = page.getByRole("button", { name: /clear/i }).element();
    if (!(clear instanceof HTMLElement)) {
      throw new Error("expected a clear button");
    }
    expect(page.getByRole("button").elements()).toHaveLength(1);

    await userEvent.click(clear);
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBeNull();
    expect(comboboxNamed("Fruit").value).toBe("");
    expect(document.activeElement).toBe(comboboxNamed("Fruit"));
    await vi.waitFor(() => {
      expect(page.getByRole("button", { name: /clear/i }).query()).toBeNull();
    });
    expect(page.getByRole("button", { name: TOGGLE_COPY["en-US"], exact: true }).query()).not.toBeNull();
  });

  it("names the caret trigger Toggle options in every locale when a Field.Label is present", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderCombobox(
        <Field.Root>
          <Field.Label>Fruit</Field.Label>
          <FruitCombobox />
        </Field.Root>,
        locale
      );
      expect(
        page.getByRole("button", { name: TOGGLE_COPY[locale], exact: true }).query(),
        locale
      ).not.toBeNull();
      unmount();
    }
  });

  it("disables the input, trigger, and clear from Combobox.Input disabled", () => {
    renderCombobox(
      <Combobox.Root items={[...FRUITS]} defaultValue="Apple">
        <Combobox.Input aria-label="Fruit" showClear disabled />
        <Combobox.Content>
          <Combobox.List>
            <Combobox.Item value="Apple">Apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
    );
    expect(comboboxNamed("Fruit")).toHaveProperty("disabled", true);
    for (const button of page.getByRole("button").elements()) {
      expect(button).toHaveProperty("disabled", true);
    }
  });

  it("appends chips in multiple mode, keeps the popup open, and removes via chip button and Backspace", async () => {
    const onValueChange = vi.fn();
    renderCombobox(
      <Combobox.Root items={[...FRUITS]} multiple onValueChange={onValueChange}>
        <Combobox.Chips aria-label="Selected fruit">
          <Combobox.Value>
            {(value: string[]) =>
              value.map((item) => (
                <Combobox.Chip key={item} removeLabel={`Remove ${item}`}>
                  {item}
                </Combobox.Chip>
              ))
            }
          </Combobox.Value>
          <Combobox.ChipsInput aria-label="Fruit" />
        </Combobox.Chips>
        <Combobox.Content>
          <Combobox.List>
            <Combobox.Collection>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                </Combobox.Item>
              )}
            </Combobox.Collection>
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
    );

    await openWithArrowDown();
    await userEvent.keyboard("{Enter}");
    expect(onValueChange.mock.calls[0]?.[0]).toEqual(["Apple"]);
    expect(page.getByRole("listbox").query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Remove Apple", exact: true }).query()).not.toBeNull();

    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["Apple", "Banana"]);

    await userEvent.click(buttonNamed("Remove Apple"));
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["Banana"]);
    expect(page.getByRole("button", { name: "Remove Apple", exact: true }).query()).toBeNull();

    const chipsInput = comboboxNamed("Fruit");
    chipsInput.focus();
    expect(chipsInput.value).toBe("");
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual([]);
  });

  it("names the chip-remove button from itemToStringLabel for object items", () => {
    const fruits = [
      { id: "apple", label: "Apple" },
      { id: "banana", label: "Banana" },
    ] as const;
    renderCombobox(
      <Combobox.Root
        items={[...fruits]}
        itemToStringLabel={(item) => item.label}
        multiple
        defaultValue={[fruits[0]]}>
        <Combobox.Chips aria-label="Selected fruit">
          <Combobox.Value>
            {(value: (typeof fruits)[number][]) =>
              value.map((item) => (
                <Combobox.Chip key={item.id}>
                  <span aria-hidden="true">★</span>
                </Combobox.Chip>
              ))
            }
          </Combobox.Value>
          <Combobox.ChipsInput aria-label="Fruit" />
        </Combobox.Chips>
      </Combobox.Root>
    );
    expect(page.getByRole("button", { name: "Remove Apple", exact: true }).query()).not.toBeNull();
  });

  it("names the chip-remove button Remove alone when neither children nor itemToStringLabel yield text", () => {
    renderCombobox(
      <Combobox.Root multiple defaultValue={[{ id: "anon" }]}>
        <Combobox.Chips aria-label="Selected fruit">
          <Combobox.Chip>
            <span aria-hidden="true">★</span>
          </Combobox.Chip>
          <Combobox.ChipsInput aria-label="Fruit" />
        </Combobox.Chips>
      </Combobox.Root>
    );
    expect(page.getByRole("button", { name: "Remove", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Remove [object Object]", exact: true }).query()).toBeNull();
  });

  it("surfaces aria-invalid on the Chips container", () => {
    renderCombobox(
      <Combobox.Root items={[...FRUITS]} multiple defaultValue={["Apple"]}>
        <Combobox.Chips aria-invalid aria-label="Selected fruit">
          <Combobox.Chip>Apple</Combobox.Chip>
          <Combobox.ChipsInput aria-label="Fruit" />
        </Combobox.Chips>
      </Combobox.Root>
    );
    const chips = document.querySelector("[data-slot=combobox-chips]");
    if (!(chips instanceof HTMLElement)) {
      throw new Error("expected chips");
    }
    expect(chips.getAttribute("aria-invalid")).toBe("true");
  });

  it("sets data-chips=true and positions against a useComboboxAnchor ref", async () => {
    function Anchored() {
      const anchor = useComboboxAnchor();
      return (
        <Combobox.Root items={[...FRUITS]} multiple>
          <Combobox.Chips ref={anchor} aria-label="Selected fruit">
            <Combobox.ChipsInput aria-label="Fruit" />
          </Combobox.Chips>
          <Combobox.Content anchor={anchor}>
            <Combobox.List>
              <Combobox.Item value="Apple">Apple</Combobox.Item>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
      );
    }
    renderCombobox(<Anchored />);
    await openWithClick();
    expect(comboboxContent().getAttribute("data-chips")).toBe("true");
  });

  it("portals Content into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderCombobox(<FruitCombobox />);
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
            <Combobox.Root items={[...FRUITS]} open>
              <Combobox.Input aria-label="Island" />
              <Combobox.Content container={node}>
                <Combobox.List>
                  <Combobox.Item value="Apple">Apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Content>
            </Combobox.Root>
          ) : null}
        </>
      );
    }
    renderCombobox(<ExplicitContainer />);
    const listbox = listboxNamed();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(listbox)).toBe(true);
    expect([...document.body.children].includes(listbox)).toBe(false);
  });

  it("waits while the resolved Content container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <Combobox.Root items={[...FRUITS]} open>
          <Combobox.Input aria-label="Pending" />
          <Combobox.Content container={ref}>
            <Combobox.List>
              <Combobox.Item value="Apple">Apple</Combobox.Item>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
      );
    }
    renderCombobox(<NeverAttached />);
    expect(page.getByRole("listbox").query()).toBeNull();
    expect(document.querySelector("[data-slot=combobox-content]")).toBeNull();
  });

  it("renders Empty, Clear, and chip-remove defaults in all four locales and honors copy overrides", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderCombobox(
        <Combobox.Root items={[...FRUITS]} defaultValue="Apple" defaultInputValue="Apple">
          <Combobox.Input aria-label="Fruit" showClear showTrigger={false} />
          <Combobox.Content>
            <Combobox.Empty />
            <Combobox.List>
              <Combobox.Item value="Apple">Apple</Combobox.Item>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>,
        locale
      );
      expect(page.getByRole("button", { name: CLEAR_COPY[locale], exact: true }).query()).not.toBeNull();
      unmount();
    }

    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderCombobox(
        <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips>
            <Combobox.Chip>Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Fruit" />
          </Combobox.Chips>
        </Combobox.Root>,
        locale
      );
      expect(
        page.getByRole("button", { name: REMOVE_APPLE_COPY[locale], exact: true }).query()
      ).not.toBeNull();
      unmount();
    }

    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderCombobox(
        <Combobox.Root items={["Apple"]}>
          <Combobox.Input aria-label="Fruit" />
          <Combobox.Content>
            <Combobox.Empty />
            <Combobox.List>
              <Combobox.Item value="Apple">Apple</Combobox.Item>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>,
        locale
      );
      await userEvent.fill(comboboxNamed("Fruit"), "zzzz");
      await vi.waitFor(() => {
        expect(page.getByText(EMPTY_COPY[locale], { exact: true }).query()).not.toBeNull();
      });
      unmount();
    }

    renderCombobox(
      <Combobox.Root items={["Apple"]} defaultValue="Apple" defaultInputValue="Apple">
        <Combobox.Input aria-label="Fruit" showClear showTrigger={false} clearLabel="Wipe it" />
        <Combobox.Content>
          <Combobox.Empty>Nothing here.</Combobox.Empty>
          <Combobox.List>
            <Combobox.Item value="Apple">Apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
    );
    expect(page.getByRole("button", { name: "Wipe it", exact: true }).query()).not.toBeNull();
    await userEvent.fill(comboboxNamed("Fruit"), "zzzz");
    await vi.waitFor(() => {
      expect(page.getByText("Nothing here.", { exact: true }).query()).not.toBeNull();
    });

    const { unmount } = renderCombobox(
      <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
        <Combobox.Chips>
          <Combobox.Chip removeLabel="Drop Apple">Apple</Combobox.Chip>
          <Combobox.ChipsInput aria-label="Fruit" />
        </Combobox.Chips>
      </Combobox.Root>
    );
    expect(page.getByRole("button", { name: "Drop Apple", exact: true }).query()).not.toBeNull();
    unmount();
  });

  it("paints the InputGroup within ring on keyboard focus and not on an addon button", async () => {
    renderCombobox(
      <>
        <button type="button">Before</button>
        <Combobox.Root items={[...FRUITS]}>
          <Combobox.Input aria-label="Fruit" showTrigger={false}>
            <InputGroup.Addon align="inline-end">
              <InputGroup.Button>Copy</InputGroup.Button>
            </InputGroup.Addon>
          </Combobox.Input>
        </Combobox.Root>
      </>
    );
    await assertWithinKeyboardFocusRingAtBothDensities(
      buttonNamed("Before"),
      comboboxNamed("Fruit"),
      inputGroupRoot()
    );

    await userEvent.click(buttonNamed("Copy"));
    expect(buttonNamed("Copy").matches(":focus-visible")).toBe(false);
    expectNoFocusRing(inputGroupRoot(), "mouse focus on an addon button must not paint the group ring");
  });
});
