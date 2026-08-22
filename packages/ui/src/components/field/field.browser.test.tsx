import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { Field } from "./field";

function fieldRootFrom(name: string): HTMLElement {
  const root = textboxNamed(name).closest("[data-slot=field]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected field root around ${name}`);
  }
  return root;
}

function tokenColor(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function tokenOpacity(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const opacity = getComputedStyle(probe).opacity;
  probe.remove();
  return opacity;
}

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
    expect(getComputedStyle(root).color).toBe(tokenColor(root, "text-error"));

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
    const label = page.getByText("Email", { exact: true }).element();
    const title = page.getByText("Account", { exact: true }).element();
    if (!(label instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      throw new Error("expected label and title");
    }
    expect(label.getAttribute("data-slot")).toBe("field-label");
    expect(title.getAttribute("data-slot")).toBe("field-title");
    expect(label.hasAttribute("data-field-heading")).toBe(true);
    expect(title.hasAttribute("data-field-heading")).toBe(true);
    const dimmed = tokenOpacity(root, "opacity-50");
    expect(getComputedStyle(label).opacity).toBe(dimmed);
    expect(getComputedStyle(title).opacity).toBe(dimmed);
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
    const name = textboxNamed("Name").closest("[data-slot=field]");
    const city = textboxNamed("City").closest("[data-slot=field]");
    expect(name?.getAttribute("data-orientation")).toBe("horizontal");
    expect(city?.getAttribute("data-orientation")).toBe("responsive");
    expect(page.getByText("Options", { exact: true }).element().getAttribute("data-variant")).toBe("label");
  });

  it("stamps data-content on Separator based on children", () => {
    renderThemed(
      <>
        <Field.Separator />
        <Field.Separator>Or</Field.Separator>
      </>
    );
    const separators = [...document.querySelectorAll("[data-slot=field-separator]")];
    expect(separators).toHaveLength(2);
    expect(separators[0]?.getAttribute("data-content")).toBe("false");
    expect(separators[1]?.getAttribute("data-content")).toBe("true");
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

    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(before instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    before.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Email"));
  });
});
