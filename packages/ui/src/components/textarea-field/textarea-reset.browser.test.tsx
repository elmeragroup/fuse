import { useState } from "react";

import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { TextareaField } from "@elmeragroup/ui/textarea-field";

import { render } from "../../../test/browser-render";
import { withLocale } from "../../../test/locale-matrix";

for (const defaultValue of ["Original", ""]) {
  for (const resetMethod of ["button", "programmatic"]) {
    it(`synchronizes ${resetMethod} reset for default ${JSON.stringify(defaultValue)}`, async () => {
      const onChange = vi.fn();
      const { host } = render(
        withLocale(
          "en-US",
          <form>
            <TextareaField label="Notes" defaultValue={defaultValue} maxLength={100} onChange={onChange} />
            <button type="reset">Reset</button>
          </form>
        )
      );
      await userEvent.fill(page.getByRole("textbox", { name: "Notes" }), "Edited text");
      await expect.element(page.getByText("11/100", { exact: true })).toBeVisible();
      const edits = onChange.mock.calls.length;
      if (resetMethod === "button") await userEvent.click(page.getByRole("button", { name: "Reset" }));
      else host.querySelector("form")?.reset();
      await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveValue(defaultValue);
      await expect.element(page.getByText(`${defaultValue.length}/100`, { exact: true })).toBeVisible();
      expect(onChange).toHaveBeenCalledTimes(edits);
    });
  }
}

it("preserves a canceled reset and removes the form subscription on unmount", async () => {
  const { host, unmount } = render(
    withLocale(
      "en-US",
      <form onReset={(event) => event.preventDefault()}>
        <TextareaField label="Notes" defaultValue="Original" maxLength={100} />
      </form>
    )
  );
  const form = host.querySelector("form");
  if (!form) throw new Error("Expected form");
  const remove = vi.spyOn(form, "removeEventListener");
  await userEvent.fill(page.getByRole("textbox", { name: "Notes" }), "Edited");
  form.reset();
  await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveValue("Edited");
  await expect.element(page.getByText("6/100", { exact: true })).toBeVisible();
  unmount();
  expect(remove.mock.calls.some(([type]) => type === "reset")).toBe(true);
  remove.mockRestore();
});

it("keeps controlled text and callbacks owned by the parent after reset", async () => {
  const onChange = vi.fn();
  function Fixture() {
    const [value, setValue] = useState("Original");
    return (
      <form>
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
  const { host } = render(withLocale("en-US", <Fixture />));
  await userEvent.fill(page.getByRole("textbox", { name: "Notes" }), "Edited");
  const edits = onChange.mock.calls.length;
  host.querySelector("form")?.reset();
  await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveValue("Edited");
  await expect.element(page.getByText("6/100", { exact: true })).toBeVisible();
  expect(onChange).toHaveBeenCalledTimes(edits);
});
