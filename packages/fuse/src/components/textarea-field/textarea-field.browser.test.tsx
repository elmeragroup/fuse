import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { fieldRootFrom, renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { TextareaField } from "./textarea-field";

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

  it("keeps the Field label when a wrapper forwards id and aria-labelledby as undefined", () => {
    renderThemed(<TextareaField label="Bio" id={undefined} aria-labelledby={undefined} />);
    const area = textboxNamed("Bio");
    expect(area.id).not.toBe("");
  });

  it("disables the textarea inside a disabled Field.Set", () => {
    renderThemed(
      <Field.Set disabled>
        <TextareaField label="Bio" />
      </Field.Set>
    );
    expect(textboxNamed("Bio")).toHaveProperty("disabled", true);
  });

  it("merges className onto the field root and textareaClassName onto the textarea", () => {
    renderThemed(<TextareaField label="Bio" className="root-marker" textareaClassName="control-marker" />);
    expect(textboxNamed("Bio").classList.contains("control-marker")).toBe(true);
    expect(textboxNamed("Bio").classList.contains("root-marker")).toBe(false);
    expect(fieldRootFrom("Bio").classList.contains("root-marker")).toBe(true);
    expect(fieldRootFrom("Bio").classList.contains("control-marker")).toBe(false);
  });

  it("calls onChange with the string value, not the event", async () => {
    const onChange = vi.fn();
    renderThemed(<TextareaField label="Notes" onChange={onChange} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Notes", exact: true }), "Ada");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("Ada");
  });

  it("keeps a controlled value when the parent does not update, and updates an uncontrolled defaultValue without onChange", async () => {
    const onChange = vi.fn();
    renderThemed(
      <>
        <TextareaField label="Bio" value="Locked" onChange={onChange} />
        <TextareaField label="Notes" defaultValue="Hello" />
      </>
    );
    const area = textboxNamed("Bio");
    expect(area).toHaveProperty("value", "Locked");
    await userEvent.type(page.getByRole("textbox", { name: "Bio", exact: true }), "x");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(expect.any(String));
    expect(onChange.mock.calls.at(-1)?.[0]).not.toBeInstanceOf(Event);
    expect(area).toHaveProperty("value", "Locked");

    const notes = textboxNamed("Notes");
    expect(notes).toHaveProperty("value", "Hello");
    await userEvent.fill(page.getByRole("textbox", { name: "Notes", exact: true }), "Hello world");
    expect(notes).toHaveProperty("value", "Hello world");
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

  it("omits the label row when neither label nor maxLength is given, and renders the 0/0 counter when maxLength is 0", () => {
    renderThemed(
      <>
        <TextareaField aria-label="Bare" />
        <TextareaField label="Notes" maxLength={0} />
      </>
    );
    expect(page.getByText("Bare", { exact: true }).query()).toBeNull();
    expect(textboxNamed("Bare").parentElement?.textContent).not.toMatch(/\d+\/\d+/);
    expect(page.getByText("0/0", { exact: true }).query()).toBeTruthy();
    const area = textboxNamed("Notes");
    expect(area).toHaveProperty("maxLength", 0);
  });
});
