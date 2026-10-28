import { createRef } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { describedTextsFor } from "../../../test/rac-calendar-testing";
import {
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
        <div style={{ width: "320px" }}>
          <Fruit />
        </div>
      )
    );
    expect(fieldBoxOf(input()).getBoundingClientRect().width).toBe(320);
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
});
