import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { fieldRootFrom, renderThemed, textboxNamed, textNamed } from "../../../test/themed-browser-render";
import { CheckboxGroup, CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { Form } from "../form/form";
import { Input } from "../input/input";
import { NumberField } from "../number-field/number-field";
import { PhoneNumberField } from "../phone-number-field/phone-number-field";
import { Radio, RadioGroup, RadioItemGroup } from "../radio-group/radio-group";
import { RadioItem } from "../radio-group/radio-item";
import { TextField } from "../text-field/text-field";
import { TextareaField } from "../textarea-field/textarea-field";
import { FieldFrame } from "./field-frame";

type GroupFixture = {
  readonly name: string;
  readonly render: (props: {
    readonly label?: string;
    readonly description?: string;
    readonly isLabelHidden?: boolean;
    readonly errorMessage?: string;
  }) => ReactElement;
};

const GROUPS: ReadonlyArray<GroupFixture> = [
  {
    name: "CheckboxGroup",
    render: ({ label, description, isLabelHidden, errorMessage }) => (
      <CheckboxGroup
        label={label}
        description={description}
        isLabelHidden={isLabelHidden}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}>
        <CheckboxItem value="a">Option</CheckboxItem>
      </CheckboxGroup>
    ),
  },
  {
    name: "RadioGroup",
    render: ({ label, description, isLabelHidden, errorMessage }) => (
      <RadioGroup
        label={label}
        description={description}
        isLabelHidden={isLabelHidden}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}>
        <Radio value="a">Option</Radio>
      </RadioGroup>
    ),
  },
  {
    name: "CheckboxItemGroup",
    render: ({ label, description, isLabelHidden, errorMessage }) => (
      <CheckboxItemGroup
        label={label}
        description={description}
        isLabelHidden={isLabelHidden}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}>
        <CheckboxItem value="a">Option</CheckboxItem>
      </CheckboxItemGroup>
    ),
  },
  {
    name: "RadioItemGroup",
    render: ({ label, description, isLabelHidden, errorMessage }) => (
      <RadioItemGroup
        label={label}
        description={description}
        isLabelHidden={isLabelHidden}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}>
        <RadioItem value="a">Option</RadioItem>
      </RadioItemGroup>
    ),
  },
];

type LabeledFixture = {
  readonly name: string;
  /** Renders the composite labelled "Field" with a description, in error when given one. */
  readonly render: (errorMessage?: string) => ReactElement;
};

const FIELD_DESCRIPTION = "Supporting copy.";

const LABELED: ReadonlyArray<LabeledFixture> = [
  {
    name: "TextField",
    render: (errorMessage) => (
      <TextField
        label="Field"
        description={FIELD_DESCRIPTION}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}
      />
    ),
  },
  {
    name: "NumberField",
    render: (errorMessage) => (
      <NumberField
        label="Field"
        description={FIELD_DESCRIPTION}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}
      />
    ),
  },
  {
    name: "TextareaField",
    render: (errorMessage) => (
      <TextareaField
        label="Field"
        description={FIELD_DESCRIPTION}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}
      />
    ),
  },
  {
    name: "PhoneNumberField",
    render: (errorMessage) => (
      <PhoneNumberField
        label="Field"
        description={FIELD_DESCRIPTION}
        isInvalid={errorMessage !== undefined}
        errorMessage={errorMessage}
      />
    ),
  },
];

/**
 * dist/styles.css ships without preflight, so the fieldset's and the description's
 * user-agent padding, border and margins would space the boxes. A Tailwind host's
 * preflight zeroes them in the base layer, below utilities.
 */
const preflightBoxReset = (
  <style>{"@layer base { *, ::before, ::after { margin: 0; padding: 0; border: 0 solid; } }"}</style>
);

/** Pixels from the bottom of `upper`'s border box to the top of `lower`'s. */
function verticalGap(upper: Element, lower: Element): number {
  return lower.getBoundingClientRect().top - upper.getBoundingClientRect().bottom;
}

/** The group primitive, whose top edge is where the first option starts. */
function optionsIn(root: Element): Element {
  // The options box is the group primitive's layout container, which has no
  // role of its own once the fieldset owns the group name, so it is reached by its slot.
  const options = root.querySelector("[data-slot=checkbox-group], [data-slot=radio-group]");
  if (options === null) {
    throw new Error("expected a checkbox-group or radio-group");
  }
  return options;
}

describe("FieldFrame", () => {
  it("names the control, links the description and the error, and omits the error when there is neither a message nor a validation error", () => {
    const { unmount } = renderThemed(
      <FieldFrame label="Email" description="Work address preferred." errorMessage="Required" invalid>
        <Input />
      </FieldFrame>
    );

    const input = textboxNamed("Email");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const described = describedBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain("Work address preferred.");
    expect(page.getByRole("alert").element().textContent).toBe("Required");
    unmount();

    renderThemed(
      <FieldFrame label="Email">
        <Input />
      </FieldFrame>
    );
    expect(page.getByRole("alert").query()).toBeNull();
  });

  it("shows each group's Form error under its name without errorMessage, and none while disabled", async () => {
    const groups = (isDisabled: boolean) => (
      <Form errors={{ toppings: "Pick a topping.", contract: "Pick a contract." }}>
        <CheckboxGroup label="Toppings" name="toppings" isDisabled={isDisabled}>
          <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
        </CheckboxGroup>
        <RadioGroup label="Contract" name="contract" isDisabled={isDisabled}>
          <Radio value="fixed">Fixed</Radio>
        </RadioGroup>
      </Form>
    );
    const { rerender } = renderThemed(groups(false));
    expect(
      page
        .getByRole("alert")
        .elements()
        .map((alert) => alert.textContent)
    ).toEqual(["Pick a topping.", "Pick a contract."]);

    rerender(groups(true));
    // Base UI unmounts a hidden error after its exit transition, a frame later.
    await expect.poll(() => page.getByRole("alert").elements()).toHaveLength(0);
  });

  it("omits the label row without a label, status, or crossfade, and the legend element without a label", () => {
    renderThemed(
      <FieldFrame description="Only a description.">
        <Input aria-label="Bare" />
      </FieldFrame>
    );
    expect(fieldRootFrom("Bare").querySelectorAll("label")).toHaveLength(0);
    expect(page.getByText("Only a description.").query()).toBeTruthy();

    renderThemed(
      <FieldFrame heading="legend" status={<span>busy</span>}>
        <Input aria-label="Bare options" />
      </FieldFrame>
    );
    const root = fieldRootFrom("Bare options");
    expect(root.querySelectorAll("legend")).toHaveLength(0);
    expect(root.querySelectorAll("label")).toHaveLength(0);
    expect(page.getByText("busy").query()).toBeTruthy();
  });
});

// Figma: a field in error shows its message directly under the control, where the
// description sits otherwise, and the description moves below the message.
describe("error placement", () => {
  it.each(LABELED)("puts the $name error in the description's place under the control", ({ render }) => {
    const { unmount } = renderThemed(
      <>
        {preflightBoxReset}
        {withLocale("en-US", render())}
      </>
    );
    const restingGap = verticalGap(textboxNamed("Field"), textNamed(FIELD_DESCRIPTION));
    unmount();

    renderThemed(
      <>
        {preflightBoxReset}
        {withLocale("en-US", render("Fix this."))}
      </>
    );
    const error = page.getByRole("alert").element();

    expect(verticalGap(textboxNamed("Field"), error)).toBeCloseTo(restingGap, 0);
    expect(verticalGap(error, textNamed(FIELD_DESCRIPTION))).toBeGreaterThanOrEqual(0);
  });

  it.each(GROUPS)(
    "keeps the $name description under its label and puts the error under the options",
    ({ render }) => {
      const { host } = renderThemed(
        <>
          {preflightBoxReset}
          {render({ label: "Group", description: "Pick any.", errorMessage: "Fix this." })}
        </>
      );
      const options = optionsIn(host);
      const error = page.getByRole("alert").element();

      expect(verticalGap(textNamed("Pick any."), options)).toBeGreaterThanOrEqual(0);
      expect(verticalGap(options, error)).toBeGreaterThanOrEqual(0);
    }
  );
});
