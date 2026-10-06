import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  fieldRootFrom,
  inputNamed,
  renderThemed,
  roleNamed,
  textNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { Checkbox } from "../checkbox/checkbox";
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

  it("shows the Form error under the control's name without children, as a list when there are several", async () => {
    const { rerender } = renderThemed(
      <Form errors={{ email: "Already registered." }}>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <Field.Control name="email" render={<input />} />
          <Field.Error />
        </Field.Root>
      </Form>
    );
    const alert = page.getByRole("alert").element();
    expect(alert.getAttribute("data-slot")).toBe("field-error");
    expect(alert.textContent).toBe("Already registered.");
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBe("true");
    await expect.element(textboxNamed("Email")).toHaveAccessibleDescription("Already registered.");

    rerender(
      <Form errors={{ email: ["Already registered.", "Use a work address."] }}>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <Field.Control name="email" render={<input />} />
          <Field.Error />
        </Field.Root>
      </Form>
    );
    const items = page
      .getByRole("alert")
      .getByRole("listitem")
      .elements()
      .map((item) => item.textContent);
    expect(items).toEqual(["Already registered.", "Use a work address."]);
  });

  it("shows the validate result and the native constraint message without children", async () => {
    renderThemed(
      <>
        <Field.Root
          validationMode="onBlur"
          validate={(value) => (String(value).length < 3 ? "Use at least 3 characters." : null)}>
          <Field.Label>Name</Field.Label>
          <Field.Control render={<input />} />
          <Field.Error />
        </Field.Root>
        <Field.Root validationMode="onBlur">
          <Field.Label>Email</Field.Label>
          <Field.Control type="email" render={<input />} />
          <Field.Error />
        </Field.Root>
      </>
    );
    expect(page.getByRole("alert").query()).toBeNull();

    await userEvent.type(textboxNamed("Name"), "Al");
    await userEvent.type(textboxNamed("Email"), "ada");
    await userEvent.keyboard("{Tab}");

    await expect.element(textboxNamed("Name")).toHaveAccessibleDescription("Use at least 3 characters.");
    // The oracle is the browser's own message for the failed `type="email"` constraint.
    const nativeMessage = inputNamed("Email").validationMessage;
    expect(nativeMessage).not.toBe("");
    await expect.element(textboxNamed("Email")).toHaveAccessibleDescription(nativeMessage);
    expect(
      page
        .getByRole("alert")
        .elements()
        .map((alert) => alert.textContent)
    ).toEqual(["Use at least 3 characters.", nativeMessage]);
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

  it("keeps the fieldset named by its legend when a wrapper forwards ARIA props and id as undefined", async () => {
    renderThemed(
      <Field.Set aria-labelledby={undefined}>
        <Field.Legend id={undefined}>Contact</Field.Legend>
      </Field.Set>
    );
    await expect.element(page.getByRole("group", { name: "Contact", exact: true })).toBeInTheDocument();
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

  it("keeps the fieldset's descriptions in DOM order as they are inserted, re-identified and reordered", async () => {
    const contactSet = (descriptions: ReactNode) => (
      <>
        <p id="contact-hint">Optional.</p>
        <Field.Set aria-describedby="contact-hint">
          <Field.Legend>Contact</Field.Legend>
          {descriptions}
        </Field.Set>
      </>
    );
    const group = page.getByRole("group", { name: "Contact", exact: true });
    const { rerender } = renderThemed(
      contactSet(<Field.Description key="day">We reply within a day.</Field.Description>)
    );
    await expect.element(group).toHaveAccessibleDescription("Optional. We reply within a day.");

    rerender(
      contactSet([
        <Field.Description key="pick">Pick one.</Field.Description>,
        <Field.Description key="day">We reply within a day.</Field.Description>,
      ])
    );
    await expect.element(group).toHaveAccessibleDescription("Optional. Pick one. We reply within a day.");

    rerender(
      contactSet([
        <Field.Description key="pick" id="pick-one">
          Pick one.
        </Field.Description>,
        <Field.Description key="day">We reply within a day.</Field.Description>,
      ])
    );
    await expect.element(group).toHaveAccessibleDescription("Optional. Pick one. We reply within a day.");
    expect(group.element().getAttribute("aria-describedby")).toBe(
      `contact-hint pick-one ${textNamed("We reply within a day.").id}`
    );

    rerender(
      contactSet([
        <Field.Description key="day">We reply within a day.</Field.Description>,
        <Field.Description key="pick" id="pick-one">
          Pick one.
        </Field.Description>,
      ])
    );
    await expect.element(group).toHaveAccessibleDescription("Optional. We reply within a day. Pick one.");
    expect(group.element().getAttribute("aria-describedby")).toBe(
      `contact-hint ${textNamed("We reply within a day.").id} pick-one`
    );
  });

  it("follows reused description elements when a reorder moves them without re-rendering", async () => {
    const pick = <Field.Description key="pick">Pick one.</Field.Description>;
    const day = <Field.Description key="day">We reply within a day.</Field.Description>;
    const contactSet = (descriptions: ReactNode) => (
      <Field.Set>
        <Field.Legend>Contact</Field.Legend>
        {descriptions}
      </Field.Set>
    );
    const group = page.getByRole("group", { name: "Contact", exact: true });
    const { rerender } = renderThemed(contactSet([pick, day]));
    await expect.element(group).toHaveAccessibleDescription("Pick one. We reply within a day.");

    rerender(contactSet([day, pick]));
    await expect.element(group).toHaveAccessibleDescription("We reply within a day. Pick one.");
    expect(group.element().getAttribute("aria-describedby")).toBe(
      `${textNamed("We reply within a day.").id} ${textNamed("Pick one.").id}`
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

  it("gives a checkbox row the heading weight on a centered pointer row, lets a consumer font-* class win, and leaves a plain label alone", () => {
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
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
      </>
    );
    const heading = textNamed("Email");
    const overridden = textNamed("SMS");
    expect(heading.getAttribute("data-slot")).toBe("field-label");
    expect(getComputedStyle(heading).fontWeight).toBe("500");
    expect(getComputedStyle(overridden).fontWeight).toBe("400");
    const checkboxRow = getComputedStyle(heading);
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
