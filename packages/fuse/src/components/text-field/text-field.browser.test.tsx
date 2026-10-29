import { createRef, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  CONTROL_MD,
  fieldRootFrom,
  fkasExternal,
  formNamed,
  inputNamed,
  px,
  renderThemed,
  stampDensity,
  textboxNamed,
  textNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Field } from "../field";
import { Form } from "../form/form";
import { TextField } from "./text-field";

function fieldSvgs(name: string): SVGElement[] {
  return [...fieldRootFrom(name).querySelectorAll("svg")];
}

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

  it("keeps the typed value and focus when the variant changes", async () => {
    const field = (variant?: "card") => (
      <TextField variant={variant} label="Usage" description="Estimated kWh" errorMessage="Too high." />
    );
    const { rerender } = renderThemed(field());
    await userEvent.type(textboxNamed("Usage"), "42");

    rerender(field("card"));
    expect(textboxNamed("Usage")).toHaveProperty("value", "42");
    expect(document.activeElement).toBe(textboxNamed("Usage"));

    rerender(field());
    expect(textboxNamed("Usage")).toHaveProperty("value", "42");
    expect(document.activeElement).toBe(textboxNamed("Usage"));
  });
});

describe("TextField card variant", () => {
  /** The card root's content box in viewport coordinates: its border box minus border and padding. */
  function contentBox(root: HTMLElement) {
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

describe("TextField", () => {
  it("renders label, description, and error by role and accessible name", () => {
    renderThemed(
      <TextField
        label="Email"
        description="Work address preferred."
        isInvalid
        errorMessage="Enter a work email."
      />
    );

    const input = textboxNamed("Email");
    expect(input.getAttribute("data-slot")).toBe("input");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const ids = describedBy.split(/\s+/).filter(Boolean);
    const alert = page.getByRole("alert").element();
    expect(alert.textContent).toBe("Enter a work email.");
    expect(ids).toContain(alert.id);
    const description = ids
      .map((id) => document.getElementById(id))
      .find((node) => node?.textContent === "Work address preferred.");
    expect(description).toBeTruthy();
  });

  it("calls onChange with the string value, not the event", async () => {
    const onChange = vi.fn();
    renderThemed(<TextField label="Name" onChange={onChange} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Name", exact: true }), "Ada");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("Ada");
  });

  it("keeps a read-only input focusable without accepting typed changes", async () => {
    renderThemed(<TextField label="Locked" isReadOnly defaultValue="Stay" />);
    const input = textboxNamed("Locked");
    expect(input).toHaveProperty("readOnly", true);
    input.focus();
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard("x");
    expect(input).toHaveProperty("value", "Stay");
  });

  it("keeps controlled digits and callbacks owned by the parent across native reset", async () => {
    const onChange = vi.fn();
    function Fixture() {
      const [value, setValue] = useState("123");
      return (
        <form aria-label="Pin form">
          <TextField
            label="Pin"
            name="pin"
            filter="numeric"
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
          />
        </form>
      );
    }
    renderThemed(<Fixture />);
    const pin = page.getByRole("textbox", { name: "Pin", exact: true });
    await userEvent.fill(pin, "456");
    const edits = onChange.mock.calls.length;

    formNamed("Pin form").reset();

    await expect.element(pin).toHaveValue("456");
    expect(onChange).toHaveBeenCalledTimes(edits);
  });

  it("forwards a ref to the inner input", () => {
    // Input's own suite proves callback refs and the numeric filter's ref merge.
    const ref = createRef<HTMLInputElement>();
    const { unmount } = renderThemed(<TextField label="Object" defaultValue="123" ref={ref} />);
    expect(ref.current).toBe(inputNamed("Object"));
    unmount();
    expect(ref.current).toBeNull();
  });

  it("renders the pending/success indicator row without a label, and success wins", () => {
    renderThemed(
      <>
        <TextField aria-label="Pending" isPending />
        <TextField aria-label="Done" isPending isSuccess />
      </>
    );

    expect(page.getByRole("textbox", { name: "Pending", exact: true }).query()).toBeTruthy();
    expect(page.getByText("Pending", { exact: true }).query()).toBeNull();

    const pendingSvgs = fieldSvgs("Pending");
    expect(pendingSvgs).toHaveLength(2);
    const pendingShown = pendingSvgs.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(pendingShown).toHaveLength(1);
    expect(pendingShown[0]?.classList.contains("animate-spin")).toBe(true);

    const doneSvgs = fieldSvgs("Done");
    expect(doneSvgs).toHaveLength(2);
    const doneShown = doneSvgs.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(doneShown).toHaveLength(1);
    expect(doneShown[0]?.classList.contains("animate-spin")).toBe(false);
  });

  it("moves focus from the label to the input and skips a disabled field", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <TextField label="Email" />
        <TextField label="Off" isDisabled />
        <button type="button">After</button>
      </>
    );

    await userEvent.click(page.getByText("Email", { exact: true }));
    expect(document.activeElement).toBe(textboxNamed("Email"));

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Email"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After", exact: true }).element());
  });
});

describe("TextField inline focus chrome", () => {
  it("paints the ring-coloured border on :focus-visible only", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <TextField label="Inline" variant="inline" />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const input = textboxNamed("Inline");
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before");
    }

    // Browser suites load styles.css without themes.css, so `--ring` is otherwise
    // unset and `border-color: var(--ring)` would be ignored as invalid.
    input.style.setProperty("--ring", "rgb(255, 0, 0)");
    expect(getComputedStyle(input).borderColor).not.toBe("rgb(255, 0, 0)");

    previous.focus();
    await userEvent.keyboard("{Tab}");
    expect(input.matches(":focus-visible")).toBe(true);
    await vi.waitFor(() => {
      expect(getComputedStyle(input).borderColor).toBe("rgb(255, 0, 0)");
    });

    await userEvent.click(previous);
    expect(input.matches(":focus-visible")).toBe(false);
    await vi.waitFor(() => {
      expect(getComputedStyle(input).borderColor).not.toBe("rgb(255, 0, 0)");
    });
  });
});

describe("TextField density metrics", () => {
  it("pins the inner input to the signed md control rung at both densities", () => {
    const { rerender } = renderThemed(<TextField label="Meter" />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const style = getComputedStyle(textboxNamed("Meter"));
      expect(px(style.height)).toBe(CONTROL_MD[density].height);
      expect(px(style.paddingInlineStart)).toBe(CONTROL_MD[density].px);
    }

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        <TextField label="Meter" />
      </ThemeScope>
    );
    expect(px(getComputedStyle(textboxNamed("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });
});
