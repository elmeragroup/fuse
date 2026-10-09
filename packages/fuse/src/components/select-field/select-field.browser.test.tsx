import { createRef, useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { describedTextsFor } from "../../../test/rac-calendar-testing";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { Field } from "../field";
import { Form } from "../form/form";
import type { FormProps } from "../form/form";
import { Select } from "../select";
import { SelectField } from "./select-field";
import type { SelectFieldProps } from "./select-field";

const PLANS = { basic: "Basic", pro: "Pro", team: "Team" } as const;

function planOptions(): ReactNode {
  return Object.entries(PLANS).map(([value, label]) => (
    <Select.Item key={value} value={value}>
      {label}
    </Select.Item>
  ));
}

function Plan(props: Partial<SelectFieldProps<string>>) {
  return (
    <SelectField<string> label="Plan" name="plan" items={PLANS} placeholder="Choose a plan" {...props}>
      {planOptions()}
    </SelectField>
  );
}

/**
 * The issue's hand-composed select, the oracle for what SelectField must reproduce: Field.Root
 * around the Select parts.
 */
function HandComposedPlan({
  required,
  disabled,
  invalid,
  defaultValue,
}: {
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  defaultValue?: string;
}) {
  return (
    <Field.Root disabled={disabled} invalid={invalid}>
      <Field.Label>Hand plan</Field.Label>
      <Select.Root
        name="handPlan"
        items={PLANS}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue}>
        <Select.Trigger className="w-full">
          <Select.Value placeholder="Choose a plan" />
        </Select.Trigger>
        <Select.Content>{planOptions()}</Select.Content>
      </Select.Root>
      <Field.Error />
    </Field.Root>
  );
}

function trigger(name = "Plan"): HTMLElement {
  return roleNamed("combobox", name);
}

async function choose(option: string, name = "Plan") {
  await userEvent.click(trigger(name));
  await userEvent.click(page.getByRole("option", { name: option, exact: true }));
  await expect.poll(() => page.getByRole("listbox").query()).toBeNull();
}

function alertTexts(): string[] {
  return page
    .getByRole("alert")
    .elements()
    .map((element) => element.textContent);
}

describe("SelectField", () => {
  it("names the trigger from its label and describes it with its error, then its description", () => {
    renderThemed(<Plan description="You can change plan later." errorMessage="Pick a plan." />);
    expect(describedTextsFor(trigger())).toEqual(["Pick a plan.", "You can change plan later."]);
    expect(trigger().textContent).toMatch(/^Choose a plan/);
  });

  it("lays the error out ahead of the description and lets the trigger fill the field", () => {
    renderThemed(
      <div style={{ width: "320px" }}>
        <Plan description="You can change plan later." errorMessage="Pick a plan." />
      </div>
    );
    const error = page.getByText("Pick a plan.", { exact: true }).element();
    const description = page.getByText("You can change plan later.", { exact: true }).element();
    expect(error.getBoundingClientRect().bottom).toBeLessThanOrEqual(description.getBoundingClientRect().top);
    expect(trigger().getBoundingClientRect().width).toBe(320);
  });

  it("marks the trigger invalid for isInvalid as Field.Root invalid marks a hand-composed one", () => {
    renderThemed(
      <>
        <Plan isInvalid />
        <HandComposedPlan invalid />
      </>
    );
    expect(trigger("Hand plan")).toHaveAttribute("data-invalid");
    expect(trigger()).toHaveAttribute("data-invalid");
    expect(trigger().getAttribute("aria-invalid")).toBe(trigger("Hand plan").getAttribute("aria-invalid"));
  });

  it("shows a Form error under its name, clears it on a new selection, and shows a new errors object", async () => {
    function Fixture() {
      const [errors, setErrors] = useState<FormProps["errors"]>({ plan: "That plan is sold out." });
      return (
        <Form aria-label="Order" errors={errors}>
          <Plan defaultValue="pro" description="You can change plan later." />
          <button type="button" onClick={() => setErrors({ plan: "That plan is sold out." })}>
            Resubmit
          </button>
        </Form>
      );
    }
    renderThemed(<Fixture />);
    expect(alertTexts()).toEqual(["That plan is sold out."]);
    expect(describedTextsFor(trigger())).toContain("That plan is sold out.");
    expect(trigger()).toHaveAttribute("data-invalid");

    await choose("Team");
    await expect.poll(alertTexts).toEqual([]);
    expect(trigger().hasAttribute("data-invalid")).toBe(false);

    await userEvent.click(roleNamed("button", "Resubmit"));
    await expect.poll(alertTexts).toEqual(["That plan is sold out."]);
    expect(trigger()).toHaveAttribute("data-invalid");
  });

  it("keeps an explicit errorMessage ahead of the Form error", () => {
    renderThemed(
      <Form aria-label="Order" errors={{ plan: "That plan is sold out." }}>
        <Plan errorMessage="Pick a plan with support." />
      </Form>
    );
    expect(alertTexts()).toEqual(["Pick a plan with support."]);
  });

  it("submits what a hand-composed Select.Root submits, in the form data and in onFormSubmit", async () => {
    const submitted = vi.fn();
    renderThemed(
      <Form
        aria-label="Order"
        onFormSubmit={(values) => {
          submitted(values);
        }}>
        <Plan defaultValue="basic" />
        <HandComposedPlan defaultValue="basic" />
        <Button type="submit">Order</Button>
      </Form>
    );
    await choose("Team");
    await choose("Team", "Hand plan");
    const data = new FormData(formNamed("Order"));
    expect(data.getAll("plan")).toEqual(["team"]);
    expect(data.getAll("plan")).toEqual(data.getAll("handPlan"));

    await userEvent.click(roleNamed("button", "Order"));
    expect(submitted).toHaveBeenCalledExactlyOnceWith({ plan: "team", handPlan: "team" });
  });

  it("blocks an empty required submit with the message a required Select.Root shows", async () => {
    const submitted = vi.fn();
    renderThemed(
      <Form aria-label="Order" onFormSubmit={submitted}>
        <Plan isRequired />
        <HandComposedPlan required />
        <Button type="submit">Order</Button>
      </Form>
    );
    await userEvent.click(roleNamed("button", "Order"));
    expect(submitted).not.toHaveBeenCalled();
    await expect.poll(alertTexts).toHaveLength(2);
    const [fieldMessage, handMessage] = alertTexts();
    expect(fieldMessage).toBe(handMessage);
    expect(trigger()).toHaveAttribute("data-invalid");
    await expect.element(page.getByRole("combobox", { name: "Plan", exact: true })).toHaveFocus();
  });

  it("disables the trigger and the submitted value as a disabled Select.Root does", () => {
    renderThemed(
      <form aria-label="Order">
        <Plan isDisabled defaultValue="pro" />
        <HandComposedPlan disabled defaultValue="pro" />
      </form>
    );
    expect(trigger()).toHaveAttribute("data-disabled");
    expect(trigger("Hand plan")).toHaveAttribute("data-disabled");
    expect(trigger().getAttribute("aria-disabled")).toBe(trigger("Hand plan").getAttribute("aria-disabled"));
    const data = new FormData(formNamed("Order"));
    expect(data.getAll("plan")).toEqual(data.getAll("handPlan"));
  });

  it("submits with the form its form prop names, as Select.Root does", () => {
    renderThemed(
      <>
        <form id="order" aria-label="Order" />
        <Plan form="order" defaultValue="pro" />
      </>
    );
    expect(new FormData(formNamed("Order")).getAll("plan")).toEqual(["pro"]);
  });

  it("forwards the ref and the remaining props to the trigger", () => {
    const ref = createRef<HTMLButtonElement>();
    renderThemed(
      <Plan ref={ref} data-testid="plan" aria-labelledby={undefined} triggerClassName="font-bold" />
    );
    expect(ref.current).toBe(trigger());
    expect(trigger()).toHaveAttribute("data-testid", "plan");
    expect(trigger()).toHaveClass("font-bold", "w-full");
  });

  it("calls onValueChange with the chosen value and follows a controlled value", async () => {
    function Fixture() {
      const [plan, setPlan] = useState<string | null>("basic");
      return (
        <>
          <Plan value={plan} onValueChange={(next) => setPlan(next)} />
          <output>{String(plan)}</output>
        </>
      );
    }
    renderThemed(<Fixture />);
    expect(trigger().textContent).toMatch(/^Basic/);
    await choose("Pro");
    expect(trigger().textContent).toMatch(/^Pro/);
    expect(page.getByRole("status").element().textContent).toBe("pro");
  });
});
