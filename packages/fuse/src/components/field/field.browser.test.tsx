import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  LABEL,
  metricPx,
  cssVarColor,
  fieldRootFrom,
  inputNamed,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Checkbox, CheckboxGroup } from "../checkbox/checkbox";
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

  it("keeps a native legend out of a grid Field.Set's cells and names the set with it", () => {
    // The built library CSS has no `grid-cols-2`, so the columns come inline.
    renderThemed(
      <Field.Set className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        <Field.Legend render={<legend />}>Address</Field.Legend>
        <Field.Root>
          <Field.Label>Street</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
        <Field.Root>
          <Field.Label>City</Field.Label>
          <Field.Control render={<input />} />
        </Field.Root>
      </Field.Set>
    );
    expect(roleNamed("group", "Address").tagName).toBe("FIELDSET");
    const legend = textNamed("Address");
    expect(legend.tagName).toBe("LEGEND");
    const street = fieldRootFrom("Street").getBoundingClientRect();
    const city = fieldRootFrom("City").getBoundingClientRect();
    // A legend in a grid cell would push Street to the second column and City to a new row.
    expect(street.top).toBe(city.top);
    expect(city.left).toBeGreaterThan(street.right);
    expect(legend.getBoundingClientRect().bottom).toBeLessThanOrEqual(street.top);
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

describe("Field group gaps follow density", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

  /** The row gap of the closest element around `text` that carries `slot`. */
  function gapAround(text: string, slot: string): number {
    // DOM audit: Field.Set, Field.Group and Field.Root have no role, so they are found by their public slot.
    const element = textNamed(text).closest(`[data-slot="${slot}"]`);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`expected a ${slot} around ${text}`);
    }
    return px(getComputedStyle(element).rowGap);
  }

  it.each(DENSITIES)(
    "gaps a field, a field set, a field group and their nested groups by the surface tiers at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <Field.Set>
          <Field.Legend>Contact</Field.Legend>
          <Field.Group>
            <Field.Root>
              <Field.Label>Root label</Field.Label>
              <input aria-label="Root input" />
            </Field.Root>
            <Field.Group>
              <Field.Root>
                <Field.Label>Nested label</Field.Label>
              </Field.Root>
            </Field.Group>
          </Field.Group>
        </Field.Set>
      );
      expect(gapAround("Root label", "field"), "field").toBe(metricPx("surface-gap-md", density));
      expect(gapAround("Contact", "field-set"), "field set").toBe(metricPx("surface-gap-xl", density));
      // DOM audit: the outer Field.Group has no role, so it is the group around the inner one.
      const outer = textNamed("Nested label")
        .closest('[data-slot="field-group"]')
        ?.parentElement?.closest('[data-slot="field-group"]');
      if (!(outer instanceof HTMLElement)) {
        throw new Error("expected the outer field group");
      }
      expect(px(getComputedStyle(outer).rowGap), "field group").toBe(metricPx("surface-gap-xl", density));
      expect(gapAround("Nested label", "field-group"), "nested field group").toBe(
        metricPx("surface-gap-lg", density)
      );
    }
  );

  it.each(DENSITIES)(
    "gaps a checkbox group's options by the sm tier stacked and the lg tier in a line at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <>
          <CheckboxGroup label="Stacked">
            <Checkbox value="a" aria-label="Stacked a" />
            <Checkbox value="b" aria-label="Stacked b" />
          </CheckboxGroup>
          <CheckboxGroup label="Inline" orientation="horizontal">
            <Checkbox value="a" aria-label="Inline a" />
            <Checkbox value="b" aria-label="Inline b" />
          </CheckboxGroup>
        </>
      );
      // The options are the Checkbox controls, which the group primitive lays out.
      const box = (name: string) => roleNamed("checkbox", name).getBoundingClientRect();
      expect(box("Stacked b").top - box("Stacked a").bottom, "stacked").toBe(
        metricPx("surface-gap-sm", density)
      );
      expect(box("Inline b").left - box("Inline a").right, "inline").toBe(
        metricPx("surface-gap-lg", density)
      );
    }
  );
});
