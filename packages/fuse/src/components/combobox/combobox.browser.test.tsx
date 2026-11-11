import type { ComponentProps, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { formNamed, renderThemed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import { Field } from "../field";
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

function renderCombobox(node: ReactNode, locale: SupportedLocale = "en-US") {
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
async function expectChipFocused(removeButtonName: string): Promise<void> {
  // Identity, not `contains`: any ancestor up to <body> contains the button, so a
  // containment check would also pass if focus escaped the chip to its container.
  // Waited for: after a removal the neighbouring chip takes focus once it re-renders.
  await vi.waitFor(() => {
    expect(document.activeElement, `the chip owning ${removeButtonName} must hold focus`).toBe(
      buttonNamed(removeButtonName).parentElement
    );
  });
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

/** Base UI mounts the popup a frame or more after the opening event, so wait for it. */
async function openedListbox(): Promise<HTMLElement> {
  await expect.element(page.getByRole("listbox")).toBeInTheDocument();
  return listboxNamed();
}

async function openWithArrowDown(name = "Fruit"): Promise<HTMLElement> {
  const input = comboboxNamed(name);
  input.focus();
  await userEvent.keyboard("{ArrowDown}");
  const listbox = await openedListbox();
  // Keyboard opening highlights an option once the list has registered its items.
  await vi.waitFor(() => highlightedOption());
  return listbox;
}

describe("Combobox", () => {
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
    await expect.element(page.getByRole("combobox", { name: "Fruit", exact: true })).toHaveFocus();
    await vi.waitFor(() => {
      expect(page.getByRole("button", { name: /clear/i }).query()).toBeNull();
    });
    expect(page.getByRole("button", { name: TOGGLE_COPY["en-US"], exact: true }).query()).not.toBeNull();
  });

  it("keeps the Field label and description on the inputs when a wrapper forwards id and ARIA props as undefined", async () => {
    renderCombobox(
      <>
        <Field.Root>
          <Field.Label>Fruit</Field.Label>
          <Combobox.Root items={[...FRUITS]}>
            <Combobox.Input id={undefined} aria-labelledby={undefined} aria-describedby={undefined} />
          </Combobox.Root>
          <Field.Description>Pick one.</Field.Description>
        </Field.Root>
        <Field.Root>
          <Field.Label>Basket</Field.Label>
          <Combobox.Root items={[...FRUITS]} multiple>
            <Combobox.Chips>
              <Combobox.ChipsInput id={undefined} aria-labelledby={undefined} aria-describedby={undefined} />
            </Combobox.Chips>
          </Combobox.Root>
          <Field.Description>Pick several.</Field.Description>
        </Field.Root>
      </>
    );
    // Each label's `for` also names its input, so the wiring is read off `aria-labelledby`.
    for (const name of ["Fruit", "Basket"]) {
      expect(comboboxNamed(name).getAttribute("aria-labelledby"), name).toBe(
        page.getByText(name, { exact: true }).element().id
      );
    }
    await expect.element(comboboxNamed("Fruit")).toHaveAccessibleDescription("Pick one.");
    await expect.element(comboboxNamed("Basket")).toHaveAccessibleDescription("Pick several.");
    expect(page.getByRole("button", { name: TOGGLE_COPY["en-US"], exact: true }).query()).not.toBeNull();
  });

  it("submits the selected value alone inside a Field, never the input's text", async () => {
    type Product = { id: string; title: string };
    const products: Product[] = [
      { id: "spot", title: "Spot price" },
      { id: "fixed", title: "Fixed price" },
    ];
    function ProductCombobox({ name }: { name?: string }) {
      return (
        <Combobox.Root
          items={products}
          defaultValue={products[1]}
          name={name}
          itemToStringLabel={(product: Product) => product.title}
          itemToStringValue={(product: Product) => product.id}>
          <Combobox.Input />
        </Combobox.Root>
      );
    }
    renderCombobox(
      <>
        <form aria-label="Field name">
          <Field.Root name="product">
            <Field.Label>Product</Field.Label>
            <ProductCombobox />
          </Field.Root>
        </form>
        <form aria-label="Combobox name">
          <Field.Root>
            <Field.Label>Plan</Field.Label>
            <ProductCombobox name="plan" />
          </Field.Root>
        </form>
      </>
    );
    await expect.element(comboboxNamed("Product")).toHaveValue("Fixed price");
    await expect.element(comboboxNamed("Plan")).toHaveValue("Fixed price");
    expect([...new FormData(formNamed("Field name")).entries()]).toEqual([["product", "fixed"]]);
    expect([...new FormData(formNamed("Combobox name")).entries()]).toEqual([["plan", "fixed"]]);

    // A half-typed search over the selection stays out of the form too.
    await userEvent.fill(comboboxNamed("Product"), "fix");
    expect([...new FormData(formNamed("Field name")).entries()]).toEqual([["product", "fixed"]]);
  });

  it("points the Field label at the input through the id on Combobox.Root", async () => {
    renderCombobox(
      <Field.Root>
        <Field.Label>Fruit</Field.Label>
        <Combobox.Root id="fruit" items={[...FRUITS]}>
          <Combobox.Input />
        </Combobox.Root>
      </Field.Root>
    );
    const label = page.getByText("Fruit", { exact: true }).element();
    expect(label.getAttribute("for")).toBe("fruit");
    expect(comboboxNamed("Fruit").id).toBe("fruit");
    await userEvent.click(label);
    expect(document.activeElement).toBe(comboboxNamed("Fruit"));
  });

  it("keeps the Field label on a standalone trigger when a wrapper forwards id and aria-labelledby as undefined", () => {
    renderCombobox(
      <Field.Root>
        <Field.Label>Fruit</Field.Label>
        <Combobox.Root items={[...FRUITS]}>
          <Combobox.Trigger id={undefined} aria-labelledby={undefined}>
            <Combobox.Value placeholder="Pick a fruit" />
          </Combobox.Trigger>
        </Combobox.Root>
      </Field.Root>
    );
    // With no input outside the popup, the trigger takes the combobox role. Its label's
    // `for` also names it, so the wiring is read off `aria-labelledby` directly.
    const trigger = page.getByRole("combobox", { name: "Fruit", exact: true }).element();
    const labelId = page.getByText("Fruit", { exact: true }).element().id;
    expect(labelId).not.toBe("");
    expect(trigger.getAttribute("aria-labelledby")).toBe(labelId);
  });

  it.each([
    ["Combobox.Input", <FruitCombobox key="input" showClear disabled />],
    [
      "Field.Root",
      <Field.Root key="field" disabled>
        <FruitCombobox showClear />
      </Field.Root>,
    ],
  ])(
    "disables the input and its buttons from %s and skips them in the Tab order",
    async (_source, combobox) => {
      renderCombobox(
        <>
          <button type="button">Before</button>
          {combobox}
          <button type="button">After</button>
        </>
      );
      await expect.element(page.getByRole("combobox", { name: "Fruit", exact: true })).toBeDisabled();
      const owned = page
        .getByRole("button")
        .elements()
        .filter((button) => !["Before", "After"].includes(button.textContent));
      expect(owned.length).toBeGreaterThan(0);
      for (const button of owned) expect(button).toHaveProperty("disabled", true);
      buttonNamed("Before").focus();
      await userEvent.tab();
      await expect.element(page.getByRole("button", { name: "After", exact: true })).toHaveFocus();
    }
  );

  it("appends chips through the popup in multiple mode and keeps the popup open", async () => {
    const onValueChange = vi.fn<(value: string[]) => void>();
    renderCombobox(
      <Combobox.Root items={[...FRUITS]} multiple onValueChange={onValueChange}>
        <Combobox.Chips aria-label="Selected fruit">
          <Combobox.Value>
            {(value: string[]) => value.map((item) => <Combobox.Chip key={item}>{item}</Combobox.Chip>)}
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
    await userEvent.click(optionNamed("Cherry"));
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([["Apple"], ["Apple", "Cherry"]]);
    expect(listboxNamed()).toBeTruthy();
    expect(buttonNamed("Remove Apple")).toBeTruthy();
    expect(buttonNamed("Remove Cherry")).toBeTruthy();
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
    await expectChipFocused("Remove Banana");

    await userEvent.keyboard("{ArrowLeft}");
    await expectChipFocused("Remove Apple");

    await userEvent.keyboard("{ArrowRight}");
    await expectChipFocused("Remove Banana");

    await userEvent.keyboard("{Delete}");
    await vi.waitFor(() => {
      expect(page.getByRole("button", { name: "Remove Banana", exact: true }).query()).toBeNull();
    });
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["Apple"]);
    await expectChipFocused("Remove Apple");

    await userEvent.keyboard("{ArrowRight}");
    await expect.element(page.getByRole("combobox", { name: "Fruit", exact: true })).toHaveFocus();
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

  // The dictionary's copy in every locale is pinned once in `combobox.test.ts`. One non-default
  // locale proves each part reads its default from the provider's locale and the right key.
  it("renders the Empty, Clear, chip-remove and caret-trigger defaults in the provider locale", async () => {
    renderCombobox(
      <>
        {/* The caret trigger keeps its dictionary name beside a Field.Label. */}
        <Field.Root>
          <Field.Label>Fruit</Field.Label>
          <FruitCombobox />
        </Field.Root>
        <Combobox.Root items={[...FRUITS]} defaultValue="Apple" defaultInputValue="Apple">
          <Combobox.Input aria-label="Picked" showClear showTrigger={false} />
        </Combobox.Root>
        <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips>
            <Combobox.Chip>Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Basket" />
          </Combobox.Chips>
        </Combobox.Root>
        <Combobox.Root items={["Apple"]}>
          <Combobox.Input aria-label="Search" showTrigger={false} />
          <Combobox.Content>
            <Combobox.Empty />
            <Combobox.List>
              <Combobox.Item value="Apple">Apple</Combobox.Item>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
      </>,
      "nb-NO"
    );
    expect(page.getByRole("button", { name: TOGGLE_COPY["nb-NO"], exact: true }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: CLEAR_COPY["nb-NO"], exact: true }).query()).not.toBeNull();
    expect(
      page.getByRole("button", { name: REMOVE_APPLE_COPY["nb-NO"], exact: true }).query()
    ).not.toBeNull();
    await userEvent.fill(comboboxNamed("Search"), "zzzz");
    await vi.waitFor(() => {
      expect(page.getByText(EMPTY_COPY["nb-NO"], { exact: true }).query()).not.toBeNull();
    });
  });

  it("lets explicit copy win over the Empty, Clear, chip-remove and caret-trigger defaults", async () => {
    renderCombobox(
      <>
        <Combobox.Root items={["Apple"]} defaultValue="Apple" defaultInputValue="Apple">
          <Combobox.Input aria-label="Search" showClear showTrigger={false} clearLabel="Wipe it" />
          <Combobox.Content>
            <Combobox.Empty>Nothing here.</Combobox.Empty>
            <Combobox.List>
              <Combobox.Item value="Apple">Apple</Combobox.Item>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
        <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips>
            <Combobox.Chip removeLabel="Drop Apple">Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Basket" />
          </Combobox.Chips>
        </Combobox.Root>
        <Combobox.Root items={["Apple"]}>
          <Combobox.Input aria-label="Shown" triggerLabel="Show fruit" />
        </Combobox.Root>
      </>
    );
    for (const name of ["Wipe it", "Drop Apple", "Show fruit"]) {
      expect(buttonNamed(name), name).toBeTruthy();
    }
    for (const fallback of [CLEAR_COPY["en-US"], TOGGLE_COPY["en-US"], REMOVE_APPLE_COPY["en-US"]]) {
      expect(page.getByRole("button", { name: fallback, exact: true }).query(), fallback).toBeNull();
    }
    await userEvent.fill(comboboxNamed("Search"), "zzzz");
    await expect.element(page.getByText("Nothing here.", { exact: true })).toBeInTheDocument();
    expect(page.getByText(EMPTY_COPY["en-US"], { exact: true }).query()).toBeNull();
  });
});
