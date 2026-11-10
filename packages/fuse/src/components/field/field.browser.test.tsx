import { StrictMode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  LABEL,
  cssVarColor,
  fieldRootFrom,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Form } from "../form/form";
import { Field } from "./index";

describe("Field", () => {
  it("omits Error from the DOM when an invalid field has no message, and alerts with given children", () => {
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

  it("shows given children instead of the field's own error", () => {
    renderThemed(
      <Form errors={{ email: "Already registered." }}>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <Field.Control name="email" render={<input />} />
          <Field.Error>Ask your administrator.</Field.Error>
        </Field.Root>
      </Form>
    );
    expect(page.getByRole("alert").element().textContent).toBe("Ask your administrator.");
  });

  it("keeps the label, description and error wiring when a wrapper forwards id and ARIA props as undefined", async () => {
    renderThemed(
      <Field.Root invalid>
        <Field.Label id={undefined}>Email</Field.Label>
        <Field.Control
          render={<input />}
          id={undefined}
          aria-labelledby={undefined}
          aria-describedby={undefined}
        />
        <Field.Description id={undefined}>Work address preferred.</Field.Description>
        <Field.Error id={undefined}>Required</Field.Error>
      </Field.Root>
    );
    // The label's `for` also names the input, so the wiring is read off `aria-labelledby`.
    expect(textboxNamed("Email").getAttribute("aria-labelledby")).toBe(textNamed("Email").id);
    await expect
      .element(textboxNamed("Email"))
      .toHaveAccessibleDescription("Work address preferred. Required");
  });

  it("describes a fieldset with the descriptions it holds outside any root, in DOM order", async () => {
    renderThemed(
      <Field.Set>
        <Field.Legend>Contact</Field.Legend>
        <Field.Description>Pick one.</Field.Description>
        <Field.Description>We reply within a day.</Field.Description>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
      </Field.Set>
    );
    const group = page.getByRole("group", { name: "Contact", exact: true });
    await expect.element(group).toHaveAccessibleDescription("Pick one. We reply within a day.");
    expect(group.element().getAttribute("aria-describedby")).toBe(
      `${textNamed("Pick one.").id} ${textNamed("We reply within a day.").id}`
    );
    expect(textNamed("Pick one.").getAttribute("data-slot")).toBe("field-description");
    expect(textboxNamed("Email").hasAttribute("aria-describedby")).toBe(false);
  });

  it("registers each fieldset description once under StrictMode's double mount", async () => {
    renderThemed(
      <StrictMode>
        <Field.Set>
          <Field.Legend>Contact</Field.Legend>
          <Field.Description>Pick one.</Field.Description>
          <Field.Description>We reply within a day.</Field.Description>
        </Field.Set>
      </StrictMode>
    );
    const group = page.getByRole("group", { name: "Contact", exact: true });
    await expect.element(group).toHaveAccessibleDescription("Pick one. We reply within a day.");
    expect(group.element().getAttribute("aria-describedby")).toBe(
      `${textNamed("Pick one.").id} ${textNamed("We reply within a day.").id}`
    );
  });

  it("lets a description inside a root in a fieldset describe the control, not the fieldset", async () => {
    renderThemed(
      <Field.Root>
        <Field.Set>
          <Field.Legend>Contact</Field.Legend>
          <Field.Description>Pick one.</Field.Description>
          <Field.Control aria-label="Email" render={<input />} />
        </Field.Set>
      </Field.Root>
    );
    await expect.element(textboxNamed("Email")).toHaveAccessibleDescription("Pick one.");
    expect(roleNamed("group", "Contact").hasAttribute("aria-describedby")).toBe(false);
  });

  it("renders a description with neither root nor fieldset as plain text, resolving a className callback", () => {
    renderThemed(
      <Field.Description className={(state) => (state.disabled ? "is-disabled" : "is-enabled")}>
        Standalone note.
      </Field.Description>
    );
    const description = textNamed("Standalone note.");
    expect(description.tagName).toBe("P");
    expect(description.getAttribute("data-slot")).toBe("field-description");
    expect(description.classList.contains("is-enabled")).toBe(true);
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

describe("Field text follows density", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

  /** The font size and line height of the element whose text is `text`, in px. */
  function typeOf(text: string) {
    const style = getComputedStyle(textNamed(text));
    return { font: px(style.fontSize), leading: px(style.lineHeight) };
  }

  it.each(DENSITIES)(
    "sets label, title, description, error and a label legend in the label type at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <Field.Set>
          <Field.Legend>Legend title</Field.Legend>
          <Field.Legend variant="label">Label legend</Field.Legend>
          <Field.Root invalid>
            <Field.Label>Email label</Field.Label>
            <Field.Title>Field title</Field.Title>
            <Field.Description>Field description</Field.Description>
            <Field.Error>Field error</Field.Error>
          </Field.Root>
        </Field.Set>
      );
      for (const text of ["Label legend", "Email label", "Field title", "Field description", "Field error"]) {
        expect(typeOf(text), `${density} ${text}`).toEqual(LABEL[density]);
      }
      // The legend variant titles the fieldset at a fixed 16/24px at both densities.
      expect(typeOf("Legend title"), `${density} legend`).toEqual({ font: 16, leading: 24 });
    }
  );
});
