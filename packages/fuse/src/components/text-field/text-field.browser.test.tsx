import { createRef, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the card variant's fill cases and the inline field's host
// cases read them.
import "../../../dist/themes.css";
import { renderInHost, surfaceHostsNamed } from "../../../test/surface-hosts";
import {
  MUTED,
  THEMED,
  describePartPaint,
  restoreDocumentThemeAroundEach,
  srgb,
} from "../../../test/surface-paint";
import type { PartCase } from "../../../test/surface-paint";
import {
  fieldRootFrom,
  formNamed,
  inputNamed,
  renderThemed,
  roleNamed,
  textboxNamed,
  textNamed,
} from "../../../test/themed-browser-render";
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
    // The pending icon spins; the success icon stands still.
    expect(pendingShown.map((svg) => getComputedStyle(svg).animationName)).not.toEqual(["none"]);

    const doneSvgs = fieldSvgs("Done");
    expect(doneSvgs).toHaveLength(2);
    const doneShown = doneSvgs.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(doneShown).toHaveLength(1);
    expect(doneShown.map((svg) => getComputedStyle(svg).animationName)).toEqual(["none"]);
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

    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Email"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });
});

// The fill the card variant paints at rest and read-only, the muted label that travels with it and
// the surface it states (see `surface-paint.tsx`). The label keeps its own muted text, so a class
// on the field does not reach it.
describePartPaint(
  [false, true].map((isReadOnly): PartCase => ({
    label: `the ${isReadOnly ? "read-only " : ""}card TextField`,
    node: () => <TextField variant="card" isReadOnly={isReadOnly} label="Usage" defaultValue="1200" />,
    text: () => textNamed("Usage"),
    role: "--muted-foreground",
    fill: isReadOnly ? MUTED : [{ role: "--card" }],
    takesClassName: false,
  }))
);

// Unit under test: the inline TextField's hover and focus fill, which reads as part of its host.
// Oracle: the computed `background-color` of the host the field rests on. The chart surface suite
// covers every host's `--surface`; this one holds the field to the hosts a form rests in. Each
// state is read alone, since the hover and focus fills are separate classes.
describe("the inline TextField", () => {
  const HOSTS = surfaceHostsNamed(["Card", "Frame.Panel", "Dialog", "the page"]);
  restoreDocumentThemeAroundEach();

  for (const { theme, scheme, name } of THEMED) {
    it.each(HOSTS)(`fills with $label on hover and focus in ${name}`, async (host) => {
      const element = await renderInHost(
        host,
        theme,
        scheme,
        <TextField variant="inline" label="Meter reading" />
      );
      const fill = srgb(getComputedStyle(element).backgroundColor);
      const input = textboxNamed("Meter reading");
      // The field root names the `inline-field` group whose hover and focus-within reveal the fill.
      const group = fieldRootFrom("Meter reading");

      await userEvent.hover(input);
      expect(input.matches(":focus"), "focused while hovered").toBe(false);
      expect(srgb(getComputedStyle(input).backgroundColor), "hovered").toEqual(fill);

      input.focus();
      await commands.parkPointer();
      expect(group.matches(":hover"), "hovered while focused").toBe(false);
      expect(input.matches(":focus"), "focused").toBe(true);
      expect(srgb(getComputedStyle(input).backgroundColor), "focused").toEqual(fill);
    });
  }
});
