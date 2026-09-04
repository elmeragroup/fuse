import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertKeyboardFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Field } from "../field/field";
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

  it("takes its accessible name from Field.Label", () => {
    renderThemed(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Input type="email" />
        <Field.Description>Work address preferred.</Field.Description>
      </Field.Root>
    );
    const input = textboxNamed("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
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

  it("fires native onChange while typing for uncontrolled and controlled values", async () => {
    const seen: string[] = [];
    function Controlled() {
      return (
        <Input
          aria-label="Controlled"
          value="Hi"
          onChange={(event) => {
            seen.push(event.currentTarget.value);
          }}
        />
      );
    }
    renderThemed(
      <>
        <Input
          aria-label="Open"
          onChange={(event) => {
            seen.push(event.currentTarget.value);
          }}
        />
        <Controlled />
      </>
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Open", exact: true }), "ab");
    expect(seen.some((value) => value.includes("a") || value.includes("ab"))).toBe(true);
    expect(textboxNamed("Controlled")).toHaveProperty("value", "Hi");
  });

  it("matches the signed md rung at both densities and does not rescope under ThemeScope", () => {
    const { rerender } = renderThemed(<Input aria-label="Meter" />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const input = textboxNamed("Meter");
      const style = getComputedStyle(input);
      expect(px(style.height)).toBe(CONTROL_MD[density].height);
      expect(px(style.paddingInlineStart)).toBe(CONTROL_MD[density].px);
      expect(px(style.fontSize)).toBe(CONTROL_MD[density].font);
      expect(px(style.lineHeight)).toBe(CONTROL_MD[density].leading);
    }

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        <Input aria-label="Meter" />
      </ThemeScope>
    );
    expect(px(getComputedStyle(textboxNamed("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });

  it("ignores a nested data-density stamp in both directions (input.md §9)", () => {
    renderThemed(
      <>
        <Input aria-label="Root" />
        <div data-density="comfortable">
          <Input aria-label="Nested comfortable" />
        </div>
        <div data-density="dense">
          <Input aria-label="Nested dense" />
        </div>
      </>
    );

    // Density is a document-root axis: `ui.css` keys the comfortable block on
    // `:root[data-density="comfortable"]`, so a nested attribute rescopes nothing.
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const rung = CONTROL_MD[density].height;
      expect(px(getComputedStyle(textboxNamed("Root")).height)).toBe(rung);
      expect(px(getComputedStyle(textboxNamed("Nested comfortable")).height)).toBe(rung);
      expect(px(getComputedStyle(textboxNamed("Nested dense")).height)).toBe(rung);
    }
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
