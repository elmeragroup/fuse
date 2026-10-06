import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { fieldRootFrom, renderThemed, textboxNamed, textNamed } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { Form } from "../form/form";
import { TextField } from "./text-field";

describe("TextField Field wiring", () => {
  it("keeps the Field label when a wrapper forwards id and aria-labelledby as undefined", () => {
    renderThemed(<TextField label="Email" id={undefined} aria-labelledby={undefined} />);
    const input = textboxNamed("Email");
    const labelId = textNamed("Email").id;
    expect(labelId).not.toBe("");
    expect(input.getAttribute("aria-labelledby")).toBe(labelId);
  });

  it("disables the input inside a disabled Field.Set", () => {
    renderThemed(
      <Field.Set disabled>
        <TextField label="Email" />
      </Field.Set>
    );
    expect(textboxNamed("Email")).toHaveProperty("disabled", true);
  });

  it("shows the Form error under its name without errorMessage, and errorMessage wins", async () => {
    const { rerender } = renderThemed(
      <Form errors={{ email: "Already registered." }}>
        <TextField label="Email" name="email" />
      </Form>
    );
    expect(page.getByRole("alert").element().textContent).toBe("Already registered.");
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBe("true");
    await expect.element(textboxNamed("Email")).toHaveAccessibleDescription("Already registered.");

    rerender(
      <Form errors={{ email: "Already registered." }}>
        <TextField label="Email" name="email" errorMessage="Ask your administrator." />
      </Form>
    );
    expect(page.getByRole("alert").element().textContent).toBe("Ask your administrator.");
  });

  it("drops the Form error once the value changes", async () => {
    renderThemed(
      <Form errors={{ email: "Already registered." }}>
        <TextField label="Email" name="email" />
      </Form>
    );
    expect(page.getByRole("alert").element().textContent).toBe("Already registered.");

    await userEvent.type(textboxNamed("Email"), "a");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBeNull();
  });
});

describe("TextField card variant", () => {
  /** The card root's content box in viewport coordinates: its border box minus border and padding. */
  function contentBox(root: HTMLElement): { left: number; right: number } {
    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    return {
      left: rect.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
      right: rect.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
    };
  }

  it("stretches the input across the card's content box without a description", () => {
    renderThemed(
      <div style={{ width: 384 }}>
        <TextField variant="card" label="Annual usage" placeholder="0" />
      </div>
    );
    const box = contentBox(fieldRootFrom("Annual usage"));
    const rect = textboxNamed("Annual usage").getBoundingClientRect();
    expect(rect.left).toBeCloseTo(box.left, 1);
    expect(rect.right).toBeCloseTo(box.right, 1);
  });

  it("ends a short description at the card's content edge, one row gap after the input", () => {
    renderThemed(
      <div style={{ width: 384 }}>
        <TextField variant="card" label="Annual usage" description="Estimated kWh" placeholder="0" />
      </div>
    );
    const description = textNamed("Estimated kWh");
    const descriptionRect = description.getBoundingClientRect();
    const box = contentBox(fieldRootFrom("Annual usage"));
    const rect = textboxNamed("Annual usage").getBoundingClientRect();
    expect(rect.left).toBeCloseTo(box.left, 1);
    // gap-3 on the card's content row.
    expect(descriptionRect.left - rect.right).toBeCloseTo(12, 1);
    expect(descriptionRect.right).toBeCloseTo(box.right, 1);
    // A short description stays on one line.
    expect(descriptionRect.height).toBeCloseTo(
      Number.parseFloat(getComputedStyle(description).lineHeight),
      0
    );
  });

  it("wraps a long description at half the row instead of squeezing the input", () => {
    const long = "Estimated annual consumption of the household, in kilowatt hours";
    renderThemed(
      <div style={{ width: 384 }}>
        <TextField variant="card" label="Annual usage" description={long} placeholder="0" />
      </div>
    );
    const description = textNamed(long);
    const descriptionRect = description.getBoundingClientRect();
    const box = contentBox(fieldRootFrom("Annual usage"));
    const rect = textboxNamed("Annual usage").getBoundingClientRect();
    const half = (box.right - box.left) / 2;
    expect(descriptionRect.width).toBeLessThanOrEqual(half + 0.5);
    expect(rect.right - rect.left).toBeGreaterThanOrEqual(half - 12 - 0.5);
    expect(descriptionRect.right).toBeCloseTo(box.right, 1);
    expect(descriptionRect.height).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(description).lineHeight)
    );
  });
});
