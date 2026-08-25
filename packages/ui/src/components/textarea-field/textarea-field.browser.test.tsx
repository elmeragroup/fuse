import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { TextareaField } from "./textarea-field";

function fieldRootFrom(name: string): HTMLElement {
  const root = textboxNamed(name).closest("[data-slot=field]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected field root around ${name}`);
  }
  return root;
}

describe("TextareaField", () => {
  it("resolves the textbox by accessible name and links description and error", () => {
    renderThemed(
      <TextareaField
        label="Bio"
        description="Shown to other users."
        isInvalid
        errorMessage={<span>Keep it under 120 characters.</span>}
      />
    );

    const area = textboxNamed("Bio");
    expect(area.getAttribute("aria-invalid")).toBe("true");
    const describedBy = area.getAttribute("aria-describedby") ?? "";
    const ids = describedBy.split(/\s+/).filter(Boolean);
    const alert = page.getByRole("alert").element();
    expect(alert.textContent).toBe("Keep it under 120 characters.");
    expect(ids).toContain(alert.id);
    const description = ids
      .map((id) => document.getElementById(id))
      .find((node) => node?.textContent === "Shown to other users.");
    expect(description).toBeTruthy();
  });

  it("omits the alert when errorMessage is absent", () => {
    renderThemed(<TextareaField label="Bio" isInvalid />);
    expect(page.getByRole("alert").query()).toBeNull();
    expect(textboxNamed("Bio").getAttribute("aria-invalid")).toBe("true");
  });

  it("calls onChange with the string value, not the event", async () => {
    const onChange = vi.fn();
    renderThemed(<TextareaField label="Notes" onChange={onChange} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Notes", exact: true }), "Ada");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("Ada");
  });

  it("keeps a controlled value on the textbox when the parent does not update", async () => {
    const onChange = vi.fn();
    renderThemed(<TextareaField label="Bio" value="Locked" onChange={onChange} />);
    const area = textboxNamed("Bio");
    expect(area).toHaveProperty("value", "Locked");
    await userEvent.type(page.getByRole("textbox", { name: "Bio", exact: true }), "x");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(expect.any(String));
    expect(onChange.mock.calls.at(-1)?.[0]).not.toBeInstanceOf(Event);
    expect(area).toHaveProperty("value", "Locked");
  });

  it("updates an uncontrolled defaultValue without onChange", async () => {
    renderThemed(<TextareaField label="Notes" defaultValue="Hello" />);
    const area = textboxNamed("Notes");
    expect(area).toHaveProperty("value", "Hello");
    await userEvent.fill(page.getByRole("textbox", { name: "Notes", exact: true }), "Hello world");
    expect(area).toHaveProperty("value", "Hello world");
  });

  it("updates an uncontrolled empty field without onChange", async () => {
    renderThemed(<TextareaField label="Notes" />);
    const area = textboxNamed("Notes");
    expect(area).toHaveProperty("value", "");
    await userEvent.fill(page.getByRole("textbox", { name: "Notes", exact: true }), "Typed");
    expect(area).toHaveProperty("value", "Typed");
  });

  it("renders 0/120 and updates from the keyboard, capping at maxLength", async () => {
    renderThemed(<TextareaField label="Bio" maxLength={120} />);
    expect(page.getByText("0/120", { exact: true }).query()).toBeTruthy();
    const area = textboxNamed("Bio");
    area.focus();
    await userEvent.keyboard("Hi");
    expect(page.getByText("2/120", { exact: true }).query()).toBeTruthy();
  });

  it("enforces maxLength natively so the count never exceeds the cap", async () => {
    renderThemed(<TextareaField label="Code" maxLength={3} />);
    const code = textboxNamed("Code");
    if (!(code instanceof HTMLTextAreaElement)) {
      throw new Error("expected a textarea");
    }
    await userEvent.fill(page.getByRole("textbox", { name: "Code", exact: true }), "abcd");
    expect(code.value.length).toBeLessThanOrEqual(3);
    expect(code.maxLength).toBe(3);
    expect(page.getByText("3/3", { exact: true }).query()).toBeTruthy();
  });

  it("natively disables the textarea, marks required, and skips disabled in tab order", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <TextareaField label="Disabled" isDisabled />
        <TextareaField label="Required" isRequired />
        <TextareaField label="Open" />
      </>
    );
    const disabled = textboxNamed("Disabled");
    expect(disabled).toHaveProperty("disabled", true);
    expect(textboxNamed("Required")).toHaveProperty("required", true);
    disabled.focus();
    expect(document.activeElement).not.toBe(disabled);

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Required"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Open"));
  });

  it("omits the label row when neither label nor maxLength is given", () => {
    renderThemed(<TextareaField aria-label="Bare" />);
    const root = fieldRootFrom("Bare");
    expect(root.querySelector("[data-slot=field-label]")).toBeNull();
    expect(root.textContent).not.toMatch(/\d+\/\d+/);
  });
});
