import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, formNamed, renderThemed } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { Form } from "../form/form";
import { Checkbox, CheckboxGroup } from "./checkbox";
import { CheckboxItem } from "./checkbox-item";

function checkboxNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("checkbox", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox named ${name}`);
  }
  return element;
}

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected group named ${name}`);
  }
  return element;
}

describe("Checkbox", () => {
  it("keeps the Field label and description when a wrapper forwards id and ARIA props as undefined", async () => {
    renderThemed(
      <Field.Root orientation="horizontal">
        <Checkbox id={undefined} aria-labelledby={undefined} aria-describedby={undefined} />
        <Field.Label>Accept terms</Field.Label>
        <Field.Description>Required to continue.</Field.Description>
      </Field.Root>
    );
    await expect.element(checkboxNamed("Accept terms")).toHaveAccessibleDescription("Required to continue.");
  });

  it("toggles from Tab focus with Space", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Field.Root orientation="horizontal">
          <Checkbox />
          <Field.Label>Alerts</Field.Label>
        </Field.Root>
      </>
    );

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(checkboxNamed("Alerts", false));
    expect(checkboxNamed("Alerts").getAttribute("data-slot")).toBe("checkbox");
    expect(checkboxNamed("Alerts").getAttribute("aria-checked")).toBe("false");
    await userEvent.keyboard(" ");
    expect(checkboxNamed("Alerts", true).getAttribute("aria-checked")).toBe("true");
  });

  it("submits what the box shows after a form action resets the form", async () => {
    const send = vi.fn<(data: FormData) => Promise<void>>(() => Promise.resolve());
    renderThemed(
      <form aria-label="Order" action={send}>
        <Field.Root name="terms">
          <Checkbox defaultChecked />
          <Field.Label>Terms</Field.Label>
        </Field.Root>
        <input name="note" aria-label="Note" />
        <button type="submit">Send</button>
      </form>
    );
    const note = page.getByRole("textbox", { name: "Note", exact: true });
    await userEvent.fill(note, "Call first");
    await userEvent.click(checkboxNamed("Terms"));
    await userEvent.click(page.getByRole("button", { name: "Send", exact: true }));
    expect(send.mock.calls[0]?.[0].has("terms")).toBe(false);

    // React's reset after the action empties the note; the box then submits what it shows.
    await expect.element(note).toHaveValue("");
    await vi.waitFor(() => {
      expect([...new FormData(formNamed("Order")).entries()]).toEqual([["note", ""]]);
    });
    expect(checkboxNamed("Terms").getAttribute("aria-checked")).toBe("false");
  });
});

describe("CheckboxGroup", () => {
  it("exposes members through the legend name and calls onChange with string[]", async () => {
    const onChange = vi.fn();
    renderThemed(
      <CheckboxGroup label="Toppings" description="Choose extras." onChange={onChange}>
        <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
        <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
      </CheckboxGroup>
    );

    expect(groupNamed("Toppings")).toBeTruthy();
    expect(checkboxNamed("Pepperoni", false).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(page.getByRole("checkbox", { name: "Pepperoni", exact: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(["pepperoni"]);
    expect(checkboxNamed("Pepperoni", true).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps a controlled value when clicks have no onChange feedback", async () => {
    renderThemed(
      <CheckboxGroup label="Toppings" value={["pepperoni"]}>
        <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
        <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
      </CheckboxGroup>
    );

    expect(checkboxNamed("Pepperoni", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Mushroom", false).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(page.getByRole("checkbox", { name: "Mushroom", exact: true }));
    expect(checkboxNamed("Pepperoni", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Mushroom", false).getAttribute("aria-checked")).toBe("false");
  });

  it("renders a ReactNode error as role=alert and stamps invalid on members", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Valid toppings" defaultValue={["pepperoni"]}>
          <CheckboxItem value="pepperoni">Valid pepperoni</CheckboxItem>
        </CheckboxGroup>
        <CheckboxGroup
          label="Toppings"
          isInvalid
          defaultValue={["pepperoni"]}
          errorMessage={<a href="#help">Fix toppings</a>}>
          <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
          <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
        </CheckboxGroup>
      </>
    );

    const alert = page.getByRole("alert").element();
    expect(page.getByRole("link", { name: "Fix toppings", exact: true }).element().parentElement).toBe(alert);
    const pepperoni = checkboxNamed("Pepperoni", true);
    expect(pepperoni.getAttribute("aria-invalid")).toBe("true");
    expect(pepperoni.hasAttribute("data-invalid")).toBe(true);
    expect(checkboxNamed("Mushroom", false).getAttribute("aria-invalid")).toBe("true");
    expect(getComputedStyle(pepperoni).borderTopColor).toBe(cssVarColor(pepperoni, "--primary"));
    expect(getComputedStyle(checkboxNamed("Mushroom", false)).borderTopColor).toBe(
      cssVarColor(pepperoni, "--error")
    );
  });

  it("threads the Field name onto member hidden inputs", async () => {
    const submitted: string[][] = [];
    renderThemed(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).getAll("toppings").map(String));
        }}>
        <CheckboxGroup name="toppings" label="Toppings" defaultValue={["pepperoni"]}>
          <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
          <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
        </CheckboxGroup>
        <button type="submit">Save</button>
      </form>
    );

    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    expect(submitted).toEqual([["pepperoni"]]);
  });

  it("submits each group's shown selection after native reset and keeps a Form error", async () => {
    function Extras() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <CheckboxGroup name="extras" label="Extras" value={value} onChange={setValue}>
          <CheckboxItem value="insurance">Insurance</CheckboxItem>
        </CheckboxGroup>
      );
    }
    renderThemed(
      <Form aria-label="Add-ons" errors={{ sauces: "Pick a sauce." }}>
        <CheckboxGroup name="toppings" label="Toppings" defaultValue={["pepperoni"]}>
          <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
          <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
        </CheckboxGroup>
        <Extras />
        <CheckboxGroup name="sauces" label="Sauces">
          <CheckboxItem value="garlic">Garlic</CheckboxItem>
        </CheckboxGroup>
      </Form>
    );
    await expect.element(page.getByText("Pick a sauce.", { exact: true })).toBeInTheDocument();
    await userEvent.click(checkboxNamed("Pepperoni"));
    await userEvent.click(checkboxNamed("Mushroom"));
    await userEvent.click(checkboxNamed("Insurance"));

    formNamed("Add-ons").reset();
    await vi.waitFor(() => {
      expect([...new FormData(formNamed("Add-ons")).entries()]).toEqual([
        ["toppings", "mushroom"],
        ["extras", "insurance"],
      ]);
    });
    expect(checkboxNamed("Pepperoni").getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Mushroom").getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Insurance").getAttribute("aria-checked")).toBe("true");
    expect(page.getByText("Pick a sauce.", { exact: true }).query()).not.toBeNull();
  });
});
