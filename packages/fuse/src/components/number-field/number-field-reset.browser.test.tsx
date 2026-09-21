import { useState } from "react";

import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { formNamed, inputNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { NumberField } from "./number-field";

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
it("restores an uncontrolled defaultValue on native reset and steps from it", async () => {
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
  const edits = onChange.mock.calls.length;

  formNamed("Quantity form").reset();

  await expect.element(quantity()).toHaveValue("5");
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

it("keeps focus in the field on a programmatic reset", async () => {
  renderThemed(
    withLocale(
      "en-US",
      <form aria-label="Quantity form">
        <NumberField label="Quantity" defaultValue={5} minValue={0} maxValue={20} />
      </form>
    )
  );
  await replaceValue("Quantity", "9");
  expect(document.activeElement).toBe(inputNamed("Quantity"));

  formNamed("Quantity form").reset();

  await expect.element(quantity()).toHaveValue("5");
  // The fresh mount must not drop the focus the native reset would have kept.
  expect(document.activeElement).toBe(inputNamed("Quantity"));
});

it("does not let the reset remount steal focus through autoFocus", async () => {
  renderThemed(
    withLocale(
      "en-US",
      <form aria-label="Quantity form">
        <NumberField label="Quantity" autoFocus defaultValue={5} />
        <button type="reset">Reset</button>
      </form>
    )
  );
  await replaceValue("Quantity", "9");
  await expect.element(quantity()).toHaveValue("9");
  const resetButton = roleNamed("button", "Reset");

  await userEvent.click(resetButton);

  await expect.element(quantity()).toHaveValue("5");
  expect(document.activeElement, "the remount must not pull focus back").toBe(resetButton);
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
