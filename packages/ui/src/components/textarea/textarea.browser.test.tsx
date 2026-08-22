import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertKeyboardFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  CONTROL_MD,
  px,
  renderThemed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { Field } from "../field/field";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a multiline textbox and keeps Enter as a newline", async () => {
    renderThemed(<Textarea aria-label="Notes" />);
    const area = textboxNamed("Notes");
    expect(area.getAttribute("data-slot")).toBe("textarea");
    area.focus();
    await userEvent.keyboard("one{Enter}two");
    if (!(area instanceof HTMLTextAreaElement)) {
      throw new Error("expected a textarea");
    }
    expect(area.value).toContain("\n");
  });

  it("gets an accessible name only when wrapped in Field.Control", () => {
    renderThemed(
      <>
        <Field.Root>
          <Field.Label>Bare</Field.Label>
          <Textarea />
        </Field.Root>
        <Field.Root>
          <Field.Label>Notes</Field.Label>
          <Field.Control render={<Textarea />} />
          <Field.Description>Optional</Field.Description>
        </Field.Root>
      </>
    );
    expect(page.getByRole("textbox", { name: "Bare", exact: true }).query()).toBeNull();
    const named = textboxNamed("Notes");
    expect(named.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("excludes disabled from tab order and stamps aria-invalid", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Textarea aria-label="Disabled" disabled aria-invalid />
        <button type="button">After</button>
      </>
    );
    const area = textboxNamed("Disabled");
    expect(area).toHaveProperty("disabled", true);
    expect(area.getAttribute("aria-invalid")).toBe("true");
    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(before instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    before.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After", exact: true }).element());
  });

  it("enforces maxLength natively", async () => {
    renderThemed(<Textarea aria-label="Code" maxLength={3} />);
    const area = textboxNamed("Code");
    if (!(area instanceof HTMLTextAreaElement)) {
      throw new Error("expected a textarea");
    }
    await userEvent.fill(page.getByRole("textbox", { name: "Code", exact: true }), "abcd");
    expect(area.value.length).toBeLessThanOrEqual(3);
  });

  it("matches md inline padding and type at both densities and keeps min-h-16", () => {
    renderThemed(<Textarea aria-label="Notes" />);
    const area = textboxNamed("Notes");
    expect(area.className.split(/\s+/)).toContain("min-h-16");
    const heights = new Set<number>();
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const style = getComputedStyle(area);
      expect(px(style.paddingInlineStart)).toBe(CONTROL_MD[density].px);
      expect(px(style.fontSize)).toBe(CONTROL_MD[density].font);
      expect(px(style.lineHeight)).toBe(CONTROL_MD[density].leading);
      heights.add(area.getBoundingClientRect().height);
    }
    expect(heights.size).toBe(1);
  });

  it("paints the shared ring on keyboard focus-visible at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Textarea aria-label="Notes" />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    await assertKeyboardFocusRingAtBothDensities(previous, textboxNamed("Notes"));
  });
});
