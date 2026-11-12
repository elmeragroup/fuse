import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { describedTextsFor } from "../../../test/rac-calendar-testing";
import {
  cssVarColor,
  fieldBoxOf,
  formNamed,
  renderThemed,
  roleNamed,
  textNamed,
} from "../../../test/themed-browser-render";
import { Autocomplete } from "../autocomplete";
import { Form } from "../form/form";
import { AutocompleteField } from "./autocomplete-field";
import type { AutocompleteFieldProps } from "./autocomplete-field";

const FRUITS = ["Apple", "Banana", "Cherry"];

/** The width of the host the field fills. */
const HOST_WIDTH = 320;

function Fruit(props: AutocompleteFieldProps<string[]>) {
  return (
    <AutocompleteField label="Fruit" name="fruit" items={FRUITS} {...props}>
      <Autocomplete.Empty />
      <Autocomplete.List>
        {(fruit: string) => (
          <Autocomplete.Item key={fruit} value={fruit}>
            {fruit}
          </Autocomplete.Item>
        )}
      </Autocomplete.List>
    </AutocompleteField>
  );
}

function input(name = "Fruit"): HTMLInputElement {
  const element = roleNamed("combobox", name);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`expected an <input> combobox named ${name}`);
  }
  return element;
}

function formEntries(name: string): [string, FormDataEntryValue][] {
  return [...new FormData(formNamed(name)).entries()];
}

describe("AutocompleteField", () => {
  it("names the input from its label, which points at the Root's id, describes it with its error, then its description, and hands it the ref", () => {
    const ref = createRef<HTMLInputElement>();
    renderThemed(
      withLocale(
        "en-US",
        <Fruit ref={ref} id="fruit" description="Any fruit will do." errorMessage="Pick a fruit." />
      )
    );
    expect(ref.current).toBe(input());
    expect(input().id).toBe("fruit");
    expect(textNamed("Fruit").getAttribute("for")).toBe("fruit");
    expect(describedTextsFor(input())).toEqual(["Pick a fruit.", "Any fruit will do."]);
  });

  it("fills the field's width with its input box", () => {
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ width: `${HOST_WIDTH}px` }}>
          <Fruit />
        </div>
      )
    );
    expect(fieldBoxOf(input()).getBoundingClientRect().width).toBe(HOST_WIDTH);
  });

  it("shows a Form error under its name, marks the input invalid, and clears it when the user edits the text", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Form aria-label="Order" errors={{ fruit: "We are out of that fruit." }}>
          <Fruit />
        </Form>
      )
    );
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(describedTextsFor(input())).toEqual(["We are out of that fruit."]);

    await userEvent.type(input(), "K");
    expect(input().getAttribute("aria-invalid")).toBeNull();
    expect(page.getByText("We are out of that fruit.", { exact: true }).query()).toBeNull();
  });

  it("submits the typed text once under its name, and the text of a picked suggestion", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Order">
          <Fruit />
        </form>
      )
    );
    await userEvent.fill(input(), "Kiwi");
    expect(formEntries("Order")).toEqual([["fruit", "Kiwi"]]);

    await userEvent.fill(input(), "Ban");
    await expect.element(page.getByRole("listbox")).toBeInTheDocument();
    await userEvent.click(roleNamed("option", "Banana"));
    await expect.poll(() => page.getByRole("listbox").query()).toBeNull();
    expect(formEntries("Order")).toEqual([["fruit", "Banana"]]);
  });

  it("disables the input and its caret and clear buttons with isDisabled", () => {
    // The caret hides while the clear button shows, so each button gets a field of its own.
    renderThemed(
      withLocale(
        "en-US",
        <>
          <Fruit isDisabled showTrigger />
          <Fruit label="Snack" isDisabled showClear defaultValue="Apple" />
        </>
      )
    );
    expect(input()).toBeDisabled();
    expect(input("Snack")).toBeDisabled();
    expect(roleNamed("button", "Toggle suggestions")).toBeDisabled();
    expect(roleNamed("button", "Clear text")).toBeDisabled();
  });

  it("marks the input required with isRequired", () => {
    renderThemed(withLocale("en-US", <Fruit isRequired />));
    expect(input()).toBeRequired();
  });

  it("announces status from one live region beside the input, outside the popup", async () => {
    const { rerender } = renderThemed(withLocale("en-US", <Fruit status={null} />));
    const status = page.getByRole("status").element();
    expect(status.textContent).toBe("");

    await userEvent.fill(input(), "a");
    await expect.element(page.getByRole("listbox")).toBeInTheDocument();
    rerender(withLocale("en-US", <Fruit status="3 fruits" />));
    await expect.poll(() => status.textContent).toBe("3 fruits");

    // The popup's Empty is a live region of its own while it is open, so check after it closes.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("listbox").query()).toBeNull();
    expect(page.getByRole("status").elements()).toEqual([status]);
  });

  it("keeps read-only text against pointer and keyboard, and paints the field box with the muted read-only fill", async () => {
    const onValueChange = vi.fn();
    // The caret hides while the clear button shows, so each button gets a field of its own.
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Order">
          <Fruit isReadOnly showTrigger defaultValue="Ban" onValueChange={onValueChange} />
          <Fruit
            label="Snack"
            name="snack"
            isReadOnly
            showClear
            defaultValue="Apple"
            onValueChange={onValueChange}
          />
        </form>
      )
    );
    expect(input()).toHaveAttribute("readonly");
    expect(input()).not.toBeDisabled();
    const box = fieldBoxOf(input());
    expect(getComputedStyle(box).backgroundColor).toBe(cssVarColor(box, "--muted"));

    // The caret opens the list to show the matching suggestions, but a click on one keeps the text.
    await userEvent.click(roleNamed("button", "Toggle suggestions"));
    await userEvent.click(roleNamed("option", "Banana"));
    expect(input().value).toBe("Ban");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("listbox").query()).toBeNull();

    // Neither a highlighted suggestion committed with Enter nor typing changes it.
    await expect.element(page.getByRole("combobox", { name: "Fruit", exact: true })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(input().value).toBe("Ban");
    await userEvent.keyboard("{Escape}{Backspace}K");
    expect(input().value).toBe("Ban");

    await userEvent.click(roleNamed("button", "Clear text"));

    expect(input("Snack").value).toBe("Apple");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(formEntries("Order")).toEqual([
      ["fruit", "Ban"],
      ["snack", "Apple"],
    ]);
  });
});
