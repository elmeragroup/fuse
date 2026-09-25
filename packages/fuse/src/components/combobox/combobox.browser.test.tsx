import { useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  assertWithinKeyboardFocusRingAtBothDensities,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { cssVarColor, px, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { InputGroup } from "../input-group";
import { useComboboxAnchor } from "./combobox";
import { Combobox } from "./index";

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
  const content = listboxNamed().closest("[data-external-anchor]");
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
  const element = page
    .getByRole("option")
    .elements()
    .find((option) => option instanceof HTMLElement && option.hasAttribute("data-highlighted"));
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

/**
 * Chips are focusable `div`s with no role of their own (base-ui), so a focused chip is
 * identified by the remove button it owns — an accessible name, not a slot.
 */
function expectChipFocused(removeButtonName: string): void {
  // Identity, not `contains`: any ancestor up to <body> contains the button, so a
  // containment check would also pass if focus escaped the chip to its container.
  expect(document.activeElement, `the chip owning ${removeButtonName} must hold focus`).toBe(
    buttonNamed(removeButtonName).parentElement
  );
}

function inputGroupRoot(name = "Fruit"): HTMLElement {
  const group = comboboxNamed(name).closest('[role="group"]');
  if (!(group instanceof HTMLElement)) {
    throw new Error("expected an input-group root");
  }
  return group;
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
    expect(content.getAttribute("data-external-anchor")).toBe("false");
    expect(optionNamed("Apple")).toBeTruthy();
    expect(optionNamed("Banana")).toBeTruthy();
  });

  it("opens from ArrowDown on the input", async () => {
    renderCombobox(<FruitCombobox />);
    await openWithArrowDown();
    expect(highlightedOption().textContent).toContain("Apple");
  });

  it("closes the popup on Escape and keeps focus on the input", async () => {
    renderCombobox(<FruitCombobox />);
    await openWithArrowDown();
    expect(optionNamed("Apple")).toBeTruthy();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(page.getByRole("option").query()).toBeNull();
    expect(document.activeElement).toBe(comboboxNamed("Fruit"));
    expect(comboboxNamed("Fruit").getAttribute("aria-expanded")).toBe("false");
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

  it("walks chips with Arrow keys and removes the focused chip with Delete", async () => {
    const onValueChange = vi.fn();
    renderCombobox(
      <Combobox.Root
        items={[...FRUITS]}
        multiple
        defaultValue={["Apple", "Banana"]}
        onValueChange={onValueChange}>
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
      </Combobox.Root>
    );

    comboboxNamed("Fruit").focus();
    await userEvent.keyboard("{ArrowLeft}");
    expectChipFocused("Remove Banana");

    await userEvent.keyboard("{ArrowLeft}");
    expectChipFocused("Remove Apple");

    await userEvent.keyboard("{ArrowRight}");
    expectChipFocused("Remove Banana");

    await userEvent.keyboard("{Delete}");
    await vi.waitFor(() => {
      expect(page.getByRole("button", { name: "Remove Banana", exact: true }).query()).toBeNull();
    });
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["Apple"]);
    expectChipFocused("Remove Apple");

    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(comboboxNamed("Fruit"));
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

  it("paints the error ring on the Chips container while aria-invalid", () => {
    renderCombobox(
      <>
        <Combobox.Root items={[...FRUITS]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips aria-label="Rejected fruit">
            <Combobox.Chip>Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-invalid aria-label="Rejected" />
          </Combobox.Chips>
        </Combobox.Root>
        <Combobox.Root items={[...FRUITS]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips aria-label="Accepted fruit">
            <Combobox.Chip>Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Accepted" />
          </Combobox.Chips>
        </Combobox.Root>
      </>
    );
    // the chips container carries role="toolbar" once a chip is
    // selected, so the invalid chrome is reachable by role and name.
    const invalid = roleNamed("toolbar", "Rejected fruit");
    const valid = roleNamed("toolbar", "Accepted fruit");
    expect(comboboxNamed("Rejected").getAttribute("aria-invalid")).toBe("true");
    expect(comboboxNamed("Accepted").getAttribute("aria-invalid")).toBeNull();

    const errorColor = cssVarColor(invalid, "--error");
    expect(getComputedStyle(invalid).borderTopColor).toBe(errorColor);
    expect(getComputedStyle(valid).borderTopColor).toBe(cssVarColor(valid, "--input"));
    expect(getComputedStyle(valid).borderTopColor).not.toBe(errorColor);
    expect(
      getComputedStyle(invalid).boxShadow,
      "the invalid chips container also paints an error ring, not only the border"
    ).not.toBe(getComputedStyle(valid).boxShadow);
  });

  it("sets data-external-anchor=true and positions against a useComboboxAnchor ref", async () => {
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
    expect(comboboxContent().getAttribute("data-external-anchor")).toBe("true");
  });

  it("keeps a search-group-less popup flush and the list at the menu-family inset", async () => {
    renderCombobox(<FruitCombobox />);
    const list = await openWithClick();
    const content = comboboxContent();
    const contentStyles = getComputedStyle(content);
    expect(px(contentStyles.paddingLeft)).toBe(0);
    expect(px(contentStyles.paddingTop)).toBe(0);
    // Menu-family rows sit in a single p-1 list box; popup padding must not double it.
    expect(px(getComputedStyle(list).paddingLeft)).toBe(4);
    expect(px(getComputedStyle(list).paddingTop)).toBe(4);
  });

  it("insets a popup that owns a search group without letting the group overflow it", async () => {
    function AnchoredSearch() {
      const anchor = useComboboxAnchor();
      return (
        <Combobox.Root items={[...FRUITS]}>
          <Combobox.Chips ref={anchor} aria-label="Selected fruit">
            <Combobox.ChipsInput aria-label="Fruit" />
          </Combobox.Chips>
          <Combobox.Content anchor={anchor}>
            {/* w-full mirrors the phone field's search group, the box the old child margin overflowed. */}
            <Combobox.Input showTrigger={false} aria-label="Filter fruit" className="w-full" />
            <Combobox.List>
              <Combobox.Item value="Apple">Apple</Combobox.Item>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
      );
    }
    renderCombobox(<AnchoredSearch />);
    await openWithClick();

    const content = comboboxContent();
    const search = comboboxNamed("Filter fruit");
    const group = search.closest('[role="group"]');
    if (!(group instanceof HTMLElement)) {
      throw new Error("expected the search input group");
    }
    const contentStyles = getComputedStyle(content);
    expect(px(contentStyles.paddingLeft)).toBe(4);
    expect(px(contentStyles.paddingTop)).toBe(6);

    // `w-full` inside `px-1` must stay within the popup box (the regression the inset fixes).
    const contentBox = content.getBoundingClientRect();
    const groupBox = group.getBoundingClientRect();
    expect(groupBox.left).toBeGreaterThanOrEqual(contentBox.left);
    expect(groupBox.right).toBeLessThanOrEqual(contentBox.right);
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

  it("pins a popup-embedded InputGroup to the sm control height at both densities", () => {
    renderCombobox(
      <Combobox.Root items={[...FRUITS]} defaultOpen>
        <Combobox.Input aria-label="Fruit" showTrigger={false} />
        <Combobox.Content>
          <Combobox.Input showTrigger={false} aria-label="Filter fruit" />
          <Combobox.List>
            <Combobox.Item value="Apple">Apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
    );
    const filter = comboboxNamed("Filter fruit");
    const group = filter.closest('[role="group"]');
    if (!(group instanceof HTMLElement)) {
      throw new Error("expected the popup InputGroup");
    }
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const probe = document.createElement("span");
      probe.style.width = "var(--control-h-sm)";
      group.append(probe);
      const rung = px(getComputedStyle(probe).width);
      probe.remove();
      expect(px(getComputedStyle(group).height), density).toBe(rung);
    }
  });
});
