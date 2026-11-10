import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertKeyboardFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { renderThemed, roleNamed, textboxNamed, textNamed } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { Input } from "./input";

describe("Input", () => {
  it("renders a textbox and forwards type", () => {
    renderThemed(
      <>
        <Input aria-label="Name" />
        <Input type="number" aria-label="Amount" />
      </>
    );
    expect(textboxNamed("Name").getAttribute("data-slot")).toBe("input");
    expect(page.getByRole("spinbutton", { name: "Amount", exact: true }).element().getAttribute("type")).toBe(
      "number"
    );
  });

  it("keeps the Field label and description when a wrapper forwards id and ARIA props as undefined", async () => {
    renderThemed(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Input id={undefined} aria-labelledby={undefined} aria-describedby={undefined} />
        <Field.Description>Work address preferred.</Field.Description>
      </Field.Root>
    );
    // The label's `for` also names the input, so the wiring is read off `aria-labelledby`.
    expect(textboxNamed("Email").getAttribute("aria-labelledby")).toBe(textNamed("Email").id);
    await expect.element(textboxNamed("Email")).toHaveAccessibleDescription("Work address preferred.");
  });

  it("is removed from tab order when disabled and stamps aria-invalid from Field", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Input aria-label="Disabled" disabled />
        <Field.Root invalid>
          <Field.Label>Email</Field.Label>
          <Input />
        </Field.Root>
        <button type="button">After</button>
      </>
    );
    expect(textboxNamed("Disabled")).toHaveProperty("disabled", true);
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBe("true");
    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Email"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });

  it("paints the shared ring on keyboard focus-visible at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Input aria-label="Email" />
      </>
    );
    await assertKeyboardFocusRingAtBothDensities(roleNamed("button", "Before"), textboxNamed("Email"));
  });
});
