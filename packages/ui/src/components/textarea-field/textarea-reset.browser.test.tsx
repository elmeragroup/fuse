import { useState } from "react";

import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { TextareaField } from "@elmeragroup/ui/textarea-field";

import { withLocale } from "../../../test/locale-matrix";
import { formNamed, renderThemed as render } from "../../../test/themed-browser-render";

/**
 * The reset listener's plumbing (button vs programmatic path, cancel, unmount) is proved in
 * `use-form-reset.browser.test.tsx`; these cases prove the textarea composite's own state
 * — the counter and the notified value — follows the native control.
 */
for (const defaultValue of ["Original", ""]) {
  it(`synchronizes the counter on reset for default ${JSON.stringify(defaultValue)}`, async () => {
    const onChange = vi.fn();
    render(
      withLocale(
        "en-US",
        <form aria-label="Notes form">
          <TextareaField label="Notes" defaultValue={defaultValue} maxLength={100} onChange={onChange} />
        </form>
      )
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Notes" }), "Edited text");
    await expect.element(page.getByText("11/100", { exact: true })).toBeVisible();
    const edits = onChange.mock.calls.length;

    formNamed("Notes form").reset();

    await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveValue(defaultValue);
    await expect.element(page.getByText(`${defaultValue.length}/100`, { exact: true })).toBeVisible();
    expect(onChange).toHaveBeenCalledTimes(edits);
  });
}

it("keeps controlled text and callbacks owned by the parent after reset", async () => {
  const onChange = vi.fn();
  function Fixture() {
    const [value, setValue] = useState("Original");
    return (
      <form aria-label="Notes form">
        <TextareaField
          label="Notes"
          value={value}
          maxLength={100}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      </form>
    );
  }
  render(withLocale("en-US", <Fixture />));
  await userEvent.fill(page.getByRole("textbox", { name: "Notes" }), "Edited");
  const edits = onChange.mock.calls.length;

  formNamed("Notes form").reset();

  await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveValue("Edited");
  await expect.element(page.getByText("6/100", { exact: true })).toBeVisible();
  expect(onChange).toHaveBeenCalledTimes(edits);
});
