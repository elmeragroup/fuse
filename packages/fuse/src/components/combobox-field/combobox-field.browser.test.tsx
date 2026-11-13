import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { describedTextsFor } from "../../../test/described-texts";
import { withLocale } from "../../../test/locale-matrix";
import {
  cssVarColor,
  fieldBoxOf,
  formNamed,
  renderThemed,
  roleNamed,
  textNamed,
} from "../../../test/themed-browser-render";
import { Combobox } from "../combobox";
import { Form } from "../form/form";
import { ComboboxField } from "./combobox-field";
import type { ComboboxFieldProps } from "./combobox-field";

const FRUITS = ["Apple", "Banana", "Cherry"];

/** The width of the host the field fills. */
const HOST_WIDTH = 320;

function Fruit(props: ComboboxFieldProps<string[]>) {
  return (
    <ComboboxField label="Fruit" name="fruit" items={FRUITS} {...props}>
      <Combobox.Empty />
      <Combobox.List>
        {(fruit: string) => (
          <Combobox.Item key={fruit} value={fruit}>
            {fruit}
          </Combobox.Item>
        )}
      </Combobox.List>
    </ComboboxField>
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

async function choose(option: string) {
  await userEvent.click(roleNamed("button", "Toggle options"));
  await expect.element(page.getByRole("listbox")).toBeInTheDocument();
  await userEvent.click(roleNamed("option", option));
  await expect.poll(() => page.getByRole("listbox").query()).toBeNull();
}

describe("ComboboxField", () => {
  it("names the input from its label, which points at the Root's id, describes it with its error, then its description, and hands it the ref", () => {
    const ref = createRef<HTMLInputElement>();
    renderThemed(
      withLocale(
        "en-US",
        <Fruit ref={ref} id="fruit" description="Pick one fruit." errorMessage="Pick a fruit." />
      )
    );
    expect(ref.current).toBe(input());
    expect(input().id).toBe("fruit");
    expect(textNamed("Fruit").getAttribute("for")).toBe("fruit");
    expect(describedTextsFor(input())).toEqual(["Pick a fruit.", "Pick one fruit."]);
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

  it("shows a Form error under its name, marks the input invalid, and clears it when the selection changes", async () => {
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

    await choose("Cherry");
    expect(input().getAttribute("aria-invalid")).toBeNull();
    expect(page.getByText("We are out of that fruit.", { exact: true }).query()).toBeNull();
  });

  it("submits the selected value once under its name", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Order">
          <Fruit />
        </form>
      )
    );
    await choose("Banana");
    expect(input().value).toBe("Banana");
    expect(formEntries("Order")).toEqual([["fruit", "Banana"]]);
  });

  it("disables the input and its caret and clear buttons with isDisabled", () => {
    // The caret hides while the clear button shows, so each button gets a field of its own.
    renderThemed(
      withLocale(
        "en-US",
        <>
          <Fruit isDisabled />
          <Fruit label="Snack" isDisabled showClear defaultValue="Apple" />
        </>
      )
    );
    expect(input()).toBeDisabled();
    expect(input("Snack")).toBeDisabled();
    expect(roleNamed("button", "Toggle options")).toBeDisabled();
    expect(roleNamed("button", "Clear selection")).toBeDisabled();
  });

  it("marks the input required with isRequired", () => {
    renderThemed(withLocale("en-US", <Fruit isRequired />));
    expect(input()).toBeRequired();
  });

  it("keeps a read-only selection against pointer and keyboard, and paints the field box with the muted read-only fill", async () => {
    const onValueChange = vi.fn();
    // The caret hides while the clear button shows, so each button gets a field of its own.
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Order">
          <Fruit isReadOnly defaultValue="Banana" onValueChange={onValueChange} />
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

    // The caret opens the list to show the options, but a click on another one keeps the value.
    await userEvent.click(roleNamed("button", "Toggle options"));
    await userEvent.click(roleNamed("option", "Cherry"));
    expect(input().value).toBe("Banana");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("listbox").query()).toBeNull();

    // Neither a highlighted option committed with Enter nor typing changes it.
    await expect.element(page.getByRole("combobox", { name: "Fruit", exact: true })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(input().value).toBe("Banana");
    await userEvent.keyboard("{Escape}{Backspace}C");
    expect(input().value).toBe("Banana");

    await userEvent.click(roleNamed("button", "Clear selection"));

    expect(input("Snack").value).toBe("Apple");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(formEntries("Order")).toEqual([
      ["fruit", "Banana"],
      ["snack", "Apple"],
    ]);
  });
});
