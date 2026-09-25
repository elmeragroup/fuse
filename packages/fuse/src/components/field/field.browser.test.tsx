import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  fieldRootFrom,
  renderThemed,
  roleNamed,
  textNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { Checkbox } from "../checkbox/checkbox";
import { Field } from "./index";

describe("Field", () => {
  it("associates the label with a control fixture", () => {
    renderThemed(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Field.Control render={<input />} />
        <Field.Description>Work address preferred.</Field.Description>
      </Field.Root>
    );

    const input = textboxNamed("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const description = describedBy === null ? null : document.getElementById(describedBy);
    expect(description?.textContent).toBe("Work address preferred.");
  });

  it("associates Error with the control when invalid with children", () => {
    renderThemed(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control render={<input />} />
        <Field.Description>Work address preferred.</Field.Description>
        <Field.Error>Required</Field.Error>
      </Field.Root>
    );

    const input = textboxNamed("Email");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const ids = describedBy.split(/\s+/).filter(Boolean);
    const alert = page.getByRole("alert").element();
    expect(alert.id.length).toBeGreaterThan(0);
    expect(ids).toContain(alert.id);
  });

  it("omits Error from the DOM without children and alerts when present", () => {
    const { rerender } = renderThemed(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control render={<input />} />
        <Field.Error />
      </Field.Root>
    );

    expect(page.getByRole("alert").query()).toBeNull();
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBe("true");
    const root = fieldRootFrom("Email");
    expect(root.getAttribute("data-invalid")).toBe("");
    expect(getComputedStyle(root).color).toBe(cssVarColor(root, "--error"));

    rerender(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control render={<input />} />
        <Field.Error>Required</Field.Error>
      </Field.Root>
    );
    const alert = page.getByRole("alert").element();
    expect(alert.getAttribute("data-slot")).toBe("field-error");
    expect(alert.textContent).toBe("Required");
  });

  it("cascades disabled from Root onto the control", () => {
    renderThemed(
      <Field.Root disabled>
        <Field.Label>Email</Field.Label>
        <Field.Title>Account</Field.Title>
        <Field.Control render={<input />} />
      </Field.Root>
    );
    expect(textboxNamed("Email")).toHaveProperty("disabled", true);
    const root = fieldRootFrom("Email");
    expect(root.getAttribute("data-disabled")).toBe("");
    const label = textNamed("Email");
    const title = textNamed("Account");
    expect(label.getAttribute("data-slot")).toBe("field-label");
    expect(title.getAttribute("data-slot")).toBe("field-title");
    expect(label.hasAttribute("data-field-heading")).toBe(true);
    expect(title.hasAttribute("data-field-heading")).toBe(true);
    expect(getComputedStyle(label).opacity).toBe("0.5");
    expect(getComputedStyle(title).opacity).toBe("0.5");
  });

  it("keeps the heading weight on a checkbox row and lets a consumer font-* class win", () => {
    renderThemed(
      <>
        <Field.Root>
          <Field.Label>
            <Checkbox />
            Email
          </Field.Label>
        </Field.Root>
        <Field.Root>
          <Field.Label className="font-normal">
            <Checkbox />
            SMS
          </Field.Label>
        </Field.Root>
      </>
    );
    const heading = textNamed("Email");
    const overridden = textNamed("SMS");
    expect(heading.getAttribute("data-slot")).toBe("field-label");
    expect(getComputedStyle(heading).fontWeight).toBe("500");
    expect(getComputedStyle(overridden).fontWeight).toBe("400");
  });

  it("centers a checkbox row on a pointer cursor and leaves a plain label alone", () => {
    renderThemed(
      <>
        <Field.Root>
          <Field.Label>
            <Checkbox />
            Email
          </Field.Label>
        </Field.Root>
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
      </>
    );
    const checkboxRow = getComputedStyle(textNamed("Email"));
    expect(checkboxRow.alignItems).toBe("center");
    expect(checkboxRow.cursor).toBe("pointer");
    const plainLabel = getComputedStyle(textNamed("Name"));
    expect(plainLabel.alignItems).not.toBe("center");
    expect(plainLabel.cursor).not.toBe("pointer");
  });

  it("reflects orientation and legend variant as data attributes", () => {
    renderThemed(
      <Field.Group>
        <Field.Root orientation="horizontal">
          <Field.Label>Name</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
        <Field.Root orientation="responsive">
          <Field.Label>City</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
        <Field.Set>
          <Field.Legend variant="label">Options</Field.Legend>
        </Field.Set>
      </Field.Group>
    );
    expect(fieldRootFrom("Name").getAttribute("data-orientation")).toBe("horizontal");
    expect(fieldRootFrom("City").getAttribute("data-orientation")).toBe("responsive");
    expect(textNamed("Options").getAttribute("data-variant")).toBe("label");
  });

  it("stamps data-content on Separator based on children", () => {
    renderThemed(
      <>
        <section aria-label="Blank separator">
          <Field.Separator />
        </section>
        <section aria-label="Labeled separator">
          <Field.Separator>Or</Field.Separator>
        </section>
      </>
    );
    const blank = roleNamed("region", "Blank separator").firstElementChild;
    const labeled = roleNamed("region", "Labeled separator").firstElementChild;
    expect(blank?.getAttribute("data-content")).toBe("false");
    expect(labeled?.getAttribute("data-content")).toBe("true");
    expect(textNamed("Or").tagName).toBe("SPAN");
  });

  it("focuses the control when the label is clicked and Tab reaches it", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
      </>
    );
    await userEvent.click(page.getByText("Email", { exact: true }));
    expect(document.activeElement).toBe(textboxNamed("Email"));

    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Email"));
  });
});
