import type { ReactNode } from "react";
import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  fieldRootFrom,
  renderThemed,
  textboxNamed,
  formNamed,
  inputNamed,
  roleNamed,
} from "../../../test/themed-browser-render";
import { Field } from "../field";
import { NumberField } from "./number-field";

const INCREASE_COPY = { "nb-NO": "Øk", "sv-SE": "Öka", "en-US": "Increase", "fi-FI": "Lisää" } as const;
const DECREASE_COPY = {
  "nb-NO": "Reduser",
  "sv-SE": "Minska",
  "en-US": "Decrease",
  "fi-FI": "Vähennä",
} as const;

const ROLE_DESCRIPTION_COPY = {
  "nb-NO": "Tallfelt",
  "sv-SE": "Nummerfält",
  "en-US": "Number field",
  "fi-FI": "Numerokenttä",
} as const;

function renderField(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function groupFrom(name: string): HTMLElement {
  const group = textboxNamed(name).parentElement;
  if (!(group instanceof HTMLElement)) {
    throw new Error(`expected field group around ${name}`);
  }
  return group;
}

function stepperIn(fieldName: string, name: "Increase" | "Decrease"): HTMLElement {
  const match = [...fieldRootFrom(fieldName).querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === name
  );
  if (!(match instanceof HTMLElement)) {
    throw new Error(`expected ${name} stepper in ${fieldName}`);
  }
  return match;
}

describe("NumberField", () => {
  it("renders the input by textbox name and the steppers by button role", () => {
    renderField(
      <NumberField label="Quantity" description="Whole packs." denomination="kr" defaultValue={2} />
    );
    const input = textboxNamed("Quantity");
    expect(input.hasAttribute("data-focus-ring-control")).toBe(true);
    expect(page.getByRole("button", { name: "Increase", exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: "Decrease", exact: true }).query()).toBeTruthy();
    expect(groupFrom("Quantity").textContent).toContain("kr");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(
      describedBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent)
        .includes("Whole packs.")
    ).toBe(true);
  });

  it("keeps the steppers out of the tab order and renders no group role around the one tab stop", async () => {
    renderField(
      <>
        <NumberField label="Quantity" defaultValue={2} />
        <button type="button">After</button>
      </>
    );
    textboxNamed("Quantity").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "After"));
    expect(page.getByRole("group").query()).toBeNull();
  });

  it("keeps the Field label when a wrapper forwards id and aria-label as undefined", () => {
    renderField(<NumberField label="Amount" id={undefined} aria-label={undefined} />);
    expect(textboxNamed("Amount").getAttribute("aria-roledescription")).toBe("Number field");
  });

  it("disables the input inside a disabled Field.Set", () => {
    renderField(
      <Field.Set disabled>
        <NumberField label="Amount" />
      </Field.Set>
    );
    expect(textboxNamed("Amount")).toHaveProperty("disabled", true);
  });

  it("steps with ArrowUp/ArrowDown and clamps Home/End to min/max", async () => {
    const onChange = vi.fn();
    renderField(
      <NumberField
        label="Quantity"
        defaultValue={4}
        minValue={0}
        maxValue={10}
        step={2}
        onChange={onChange}
      />
    );
    const input = textboxNamed("Quantity");
    input.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith(6);
    await userEvent.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith(4);
    await userEvent.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith(10);
    await userEvent.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("stays controlled from a NaN empty state: only the parent moves the value", async () => {
    const events: number[] = [];
    function ControlledQuantity() {
      const [value, setValue] = useState<number>(NaN);
      return (
        <>
          <NumberField
            label="Quantity"
            minValue={0}
            maxValue={20}
            value={value}
            onChange={(next) => {
              events.push(next);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setValue(7);
            }}>
            Set to 7
          </button>
        </>
      );
    }
    renderField(<ControlledQuantity />);

    const input = page.getByRole("textbox", { name: "Quantity", exact: true });
    await expect.element(input).toHaveValue("");
    await userEvent.click(page.getByRole("button", { name: "Increase", exact: true }));

    // The step reports upward, but the parent did not accept it. An uncontrolled field
    // would have painted its own "0" here; the DOM staying empty is the controlled
    // contract, and the external set below proves the parent can still drive the input.
    expect(events).toEqual([0]);
    await expect.element(input).toHaveValue("");

    await userEvent.click(page.getByRole("button", { name: "Set to 7", exact: true }));
    await expect.element(input).toHaveValue("7");
    expect(events).toEqual([0]);
  });

  it("clamps values outside min/max on commit and disables steppers at bounds", async () => {
    const onChange = vi.fn();
    renderField(
      <NumberField label="Quantity" defaultValue={5} minValue={0} maxValue={10} onChange={onChange} />
    );
    const input = textboxNamed("Quantity");
    await userEvent.fill(page.getByRole("textbox", { name: "Quantity", exact: true }), "99");
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(stepperIn("Quantity", "Increase")).toHaveProperty("disabled", true);
    expect(stepperIn("Quantity", "Decrease")).toHaveProperty("disabled", false);

    await userEvent.fill(page.getByRole("textbox", { name: "Quantity", exact: true }), "-4");
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(stepperIn("Quantity", "Decrease")).toHaveProperty("disabled", true);
    expect(stepperIn("Quantity", "Increase")).toHaveProperty("disabled", false);
  });

  it("names the steppers and describes the input's role from the provider locale, updates them on locale rerender, and lets increaseLabel and decreaseLabel override independently", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderField(<NumberField label="Quantity" defaultValue={2} />, locale);
      expect(textboxNamed("Quantity").getAttribute("aria-roledescription"), locale).toBe(
        ROLE_DESCRIPTION_COPY[locale]
      );
      expect(
        page.getByRole("button", { name: INCREASE_COPY[locale], exact: true }).query(),
        locale
      ).toBeTruthy();
      expect(
        page.getByRole("button", { name: DECREASE_COPY[locale], exact: true }).query(),
        locale
      ).toBeTruthy();
      unmount();
    }

    const { rerender, unmount: unmountLocaleField } = renderField(
      <NumberField label="Amount" defaultValue={1234.5} />,
      "en-US"
    );
    expect(page.getByRole("button", { name: INCREASE_COPY["en-US"], exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: DECREASE_COPY["en-US"], exact: true }).query()).toBeTruthy();
    expect(textboxNamed("Amount")).toHaveProperty("value", "1,234.5");

    rerender(withLocale("nb-NO", <NumberField label="Amount" defaultValue={1234.5} />));
    expect(page.getByRole("button", { name: INCREASE_COPY["nb-NO"], exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: DECREASE_COPY["nb-NO"], exact: true }).query()).toBeTruthy();
    expect(textboxNamed("Amount")).toHaveProperty("value", "1\u00a0234,5");
    unmountLocaleField();

    const { rerender: rerenderOverride, unmount } = renderField(
      <NumberField label="Quantity" defaultValue={2} increaseLabel="Add one" decreaseLabel="Remove one" />,
      "nb-NO"
    );
    expect(page.getByRole("button", { name: "Add one", exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: "Remove one", exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: "Øk", exact: true }).query()).toBeNull();
    expect(page.getByRole("button", { name: "Reduser", exact: true }).query()).toBeNull();

    rerenderOverride(
      withLocale(
        "fi-FI",
        <NumberField label="Quantity" defaultValue={2} increaseLabel="Add one" decreaseLabel="Remove one" />
      )
    );
    expect(page.getByRole("button", { name: "Add one", exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: "Remove one", exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: "Lisää", exact: true }).query()).toBeNull();
    expect(page.getByRole("button", { name: "Vähennä", exact: true }).query()).toBeNull();
    unmount();

    renderField(<NumberField label="Quantity" defaultValue={2} increaseLabel="Add one" />, "sv-SE");
    expect(page.getByRole("button", { name: "Add one", exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: DECREASE_COPY["sv-SE"], exact: true }).query()).toBeTruthy();
  });
  it("disables the input and steppers, and keeps a read-only input focusable", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <NumberField label="Disabled" isDisabled defaultValue={3} />
        <NumberField label="Locked" isReadOnly defaultValue={7} />
      </>
    );
    expect(textboxNamed("Disabled")).toHaveProperty("disabled", true);
    expect(stepperIn("Disabled", "Increase").getAttribute("aria-disabled")).toBe("true");
    expect(textboxNamed("Locked")).toHaveProperty("readOnly", true);
    expect(stepperIn("Locked", "Increase").getAttribute("aria-disabled")).toBe("true");
    expect(stepperIn("Locked", "Decrease").getAttribute("aria-disabled")).toBe("true");

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Locked"));
    await userEvent.keyboard("{ArrowUp}");
    await expect.element(textboxNamed("Locked")).toHaveValue("7");
  });

  it.each([
    ["valid", {}, null, ""],
    ["invalid", { isInvalid: true }, "true", ""],
    [
      "invalid with an error",
      { isInvalid: true, errorMessage: "Enter a quantity." },
      "true",
      "Enter a quantity.",
    ],
  ] as const)(
    "marks a %s field and describes its input by the error",
    async (_label, props, invalid, description) => {
      renderField(<NumberField label="Quantity" defaultValue={1} {...props} />);
      expect(groupFrom("Quantity").getAttribute("aria-invalid")).toBe(invalid);
      await expect.element(textboxNamed("Quantity")).toHaveAccessibleDescription(description);
      expect(page.getByRole("alert").query()?.textContent ?? "").toBe(description);
    }
  );

  // A wrapper forwarding its optional props as `undefined` must keep the Field label, skip
  // autofocus and submit the same value as omitting them.
  it("submits the numeric value through the hidden input with optional props forwarded as undefined", async () => {
    const submitted: Array<FormDataEntryValue | null> = [];
    renderField(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get("qty"));
        }}>
        <NumberField
          label="Quantity"
          name="qty"
          defaultValue={1234}
          id={undefined}
          aria-label={undefined}
          autoFocus={undefined}
          minValue={undefined}
          formatOptions={undefined}
        />
        <button type="submit">Save</button>
      </form>
    );
    expect(document.activeElement).not.toBe(textboxNamed("Quantity"));
    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    expect(submitted).toEqual(["1234"]);
  });
});

describe("NumberField onValueCommitted", () => {
  // Each oracle is the list of commits written out by hand: one entry per finished edit.
  it("commits a typed value once on blur, not on each character or on Enter", async () => {
    const commits: number[] = [];
    const onChange = vi.fn();
    renderField(
      <NumberField label="Quantity" onChange={onChange} onValueCommitted={(value) => commits.push(value)} />
    );
    const input = textboxNamed("Quantity");
    input.focus();
    await userEvent.keyboard("42");
    expect(onChange).toHaveBeenLastCalledWith(42);
    expect(commits).toEqual([]);
    await userEvent.keyboard("{Enter}");
    expect(commits).toEqual([]);
    await userEvent.tab();
    expect(commits).toEqual([42]);
  });

  it("commits NaN when a cleared input blurs", async () => {
    const commits: number[] = [];
    renderField(
      <NumberField label="Quantity" defaultValue={12} onValueCommitted={(value) => commits.push(value)} />
    );
    textboxNamed("Quantity").focus();
    await userEvent.keyboard("{End}{Backspace}{Backspace}");
    expect(commits).toEqual([]);
    await userEvent.tab();
    expect(commits).toEqual([NaN]);
  });

  it("commits the clamped value of a controlled field, which the parent then shows", async () => {
    const commits: number[] = [];
    function Controlled() {
      const [value, setValue] = useState(5);
      return (
        <NumberField
          label="Quantity"
          maxValue={10}
          value={value}
          onChange={setValue}
          onValueCommitted={(next) => commits.push(next)}
        />
      );
    }
    renderField(<Controlled />);
    await userEvent.fill(page.getByRole("textbox", { name: "Quantity", exact: true }), "99");
    expect(commits).toEqual([]);
    await userEvent.tab();
    expect(commits).toEqual([10]);
    await expect.element(page.getByRole("textbox", { name: "Quantity", exact: true })).toHaveValue("10");
  });
});

describe("form reset", () => {
  /**
   * Replaces the field's text. `userEvent.fill` cannot be used on the first focus: base-ui moves
   * the caret to the end in `onFocus`, so `select()` before typing is what makes this deterministic.
   */
  async function replaceValue(fieldName: string, text: string): Promise<void> {
    const input = inputNamed(fieldName);
    input.focus();
    input.select();
    await userEvent.keyboard(text);
  }

  const quantity = () => page.getByRole("textbox", { name: "Quantity", exact: true });

  /**
   * The reset listener's plumbing (button vs programmatic path, cancel, unmount) is proved in
   * `use-form-reset.browser.test.tsx`. NumberField remounts its base-ui root on reset, so these
   * cases prove the remount restores the committed value and never moves focus.
   */
  it("restores an uncontrolled defaultValue on native reset, keeps focus in the field, and steps from it", async () => {
    const onChange = vi.fn();
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Quantity form">
          <NumberField
            label="Quantity"
            name="quantity"
            defaultValue={5}
            minValue={0}
            maxValue={20}
            onChange={onChange}
          />
        </form>
      )
    );
    await replaceValue("Quantity", "9");
    await expect.element(quantity()).toHaveValue("9");
    expect(document.activeElement).toBe(inputNamed("Quantity"));
    const edits = onChange.mock.calls.length;

    formNamed("Quantity form").reset();

    await expect.element(quantity()).toHaveValue("5");
    // The fresh mount must not drop the focus the native reset would have kept.
    expect(document.activeElement).toBe(inputNamed("Quantity"));
    expect(onChange, "native reset does not call onChange").toHaveBeenCalledTimes(edits);
    expect(new FormData(formNamed("Quantity form")).get("quantity")).toBe("5");

    // The committed value must reset too, not just the painted text.
    await userEvent.click(roleNamed("button", "Increase"));
    expect(inputNamed("Quantity")).toHaveProperty("value", "6");
  });

  it("resets an uncontrolled field with no defaultValue to empty", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Quantity form">
          <NumberField label="Quantity" name="quantity" minValue={0} maxValue={20} />
        </form>
      )
    );
    await replaceValue("Quantity", "9");

    formNamed("Quantity form").reset();

    await expect.element(quantity()).toHaveValue("");
    expect(new FormData(formNamed("Quantity form")).get("quantity")).toBe("");
  });

  it("keeps a controlled value parent-owned through native reset", async () => {
    const onChange = vi.fn<(value: number) => void>();
    function ControlledQuantity() {
      const [current, setCurrent] = useState(5);
      return (
        <form aria-label="Quantity form">
          <NumberField
            label="Quantity"
            value={current}
            onChange={(next) => {
              onChange(next);
              setCurrent(next);
            }}
          />
        </form>
      );
    }
    renderThemed(withLocale("en-US", <ControlledQuantity />));
    await replaceValue("Quantity", "9");
    await expect.element(quantity()).toHaveValue("9");
    const edits = onChange.mock.calls.length;

    formNamed("Quantity form").reset();

    await expect.element(quantity()).toHaveValue("9");
    expect(onChange).toHaveBeenCalledTimes(edits);
  });
});
