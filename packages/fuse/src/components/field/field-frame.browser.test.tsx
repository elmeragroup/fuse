import type { ComponentType, ReactElement, ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import {
  assertLabelHiddenLayout,
  assertLabelShownLayout,
  legendFieldset,
} from "../../../test/assert-group-label-hidden";
import { withLocale } from "../../../test/locale-matrix";
import {
  fieldRootFrom,
  renderThemed,
  roleNamed,
  stampDensity,
  textboxNamed,
  textNamed,
} from "../../../test/themed-browser-render";
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

const DENSITIES = ["dense", "comfortable"] as const;

// Figma (funnel nodes 9160:36033 and 9160:36034): a group's description sits directly
// under its label, the options follow at the fieldset's 12px group gap, and a group
// without a description keeps 24px between label and options.
const LEGEND_TO_DESCRIPTION_PX = 0;
const DESCRIPTION_TO_OPTIONS_PX = 12;
const LEGEND_TO_OPTIONS_PX = 24;
// A pending RadioGroup without a label keeps a heading row for its spinner, and the
// fieldset's group gap separates that row from the description.
const STATUS_ROW_TO_DESCRIPTION_PX = 12;
// TextField's label sits on the Field.Root's `gap-1` stack, at 4px from its control.
const TEXT_FIELD_LABEL_TO_CONTROL_PX = 4;

type GroupFixture = {
  readonly name: string;
  readonly render: (props: {
    readonly label?: string;
    readonly description?: string;
    readonly isLabelHidden?: boolean;
  }) => ReactElement;
};

const GROUPS: ReadonlyArray<GroupFixture> = [
  {
    name: "CheckboxGroup",
    render: ({ label, description, isLabelHidden }) => (
      <CheckboxGroup label={label} description={description} isLabelHidden={isLabelHidden}>
        <CheckboxItem value="a">Option</CheckboxItem>
      </CheckboxGroup>
    ),
  },
  {
    name: "RadioGroup",
    render: ({ label, description, isLabelHidden }) => (
      <RadioGroup label={label} description={description} isLabelHidden={isLabelHidden}>
        <Radio value="a">Option</Radio>
      </RadioGroup>
    ),
  },
  {
    name: "CheckboxItemGroup",
    render: ({ label, description, isLabelHidden }) => (
      <CheckboxItemGroup label={label} description={description} isLabelHidden={isLabelHidden}>
        <CheckboxItem value="a">Option</CheckboxItem>
      </CheckboxItemGroup>
    ),
  },
  {
    name: "RadioItemGroup",
    render: ({ label, description, isLabelHidden }) => (
      <RadioItemGroup label={label} description={description} isLabelHidden={isLabelHidden}>
        <RadioItem value="a">Option</RadioItem>
      </RadioItemGroup>
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
  // DOM audit: the options box is the group primitive's layout container, which has no
  // role of its own once the fieldset owns the group name, so it is reached by its slot.
  const options = root.querySelector("[data-slot=checkbox-group], [data-slot=radio-group]");
  if (options === null) {
    throw new Error("expected a checkbox-group or radio-group");
  }
  return options;
}

/** The top of `element`'s content box, inside its border and padding. */
function contentBoxTop(element: Element): number {
  const style = getComputedStyle(element);
  return (
    element.getBoundingClientRect().top +
    Number.parseFloat(style.borderTopWidth) +
    Number.parseFloat(style.paddingTop)
  );
}

function fieldsetIn(root: Element): Element {
  // DOM audit: an unlabeled fieldset has no accessible name to query it by.
  const fieldset = root.querySelector("fieldset");
  if (fieldset === null) {
    throw new Error("expected a fieldset");
  }
  return fieldset;
}

function statusSvgs(root: HTMLElement): SVGElement[] {
  return [...root.querySelectorAll("svg")];
}

/** A public labeled group composite, its member, and the `data-slot` of its group primitive. */
type LabelHiddenCase = {
  readonly part: string;
  readonly Group: ComponentType<{ label: string; isLabelHidden?: boolean; children: ReactNode }>;
  readonly Member: ComponentType<{ value: string; children: ReactNode }>;
  readonly slot: string;
};

const labelHiddenCases: ReadonlyArray<LabelHiddenCase> = [
  { part: "CheckboxGroup", Group: CheckboxGroup, Member: CheckboxItem, slot: "checkbox-group" },
  { part: "CheckboxItemGroup", Group: CheckboxItemGroup, Member: CheckboxItem, slot: "checkbox-group" },
  { part: "RadioGroup", Group: RadioGroup, Member: RadioItem, slot: "radio-group" },
  { part: "RadioItemGroup", Group: RadioItemGroup, Member: RadioItem, slot: "radio-group" },
];

function groupBody(fieldset: HTMLElement, slot: string): HTMLElement {
  // DOM audit: the group primitive's top is the layout contract; the group's name is checked by role.
  const body = fieldset.querySelector(`[data-slot=${slot}]`);
  if (!(body instanceof HTMLElement)) {
    throw new Error(`expected the ${slot} primitive in the fieldset`);
  }
  return body;
}

function nestedOrientationStamps(root: HTMLElement): Element[] {
  return [...root.querySelectorAll("[data-orientation]")];
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

  it("renders a component-owned status face in the label row and forces the row to exist", () => {
    renderThemed(
      <FieldFrame status={<span>3/10</span>}>
        <Input aria-label="Counted" />
      </FieldFrame>
    );
    const counter = page.getByText("3/10").element();
    expect(fieldRootFrom("Counted").contains(counter)).toBe(true);
  });

  it("crossfades the pending and success faces, success winning", () => {
    renderThemed(
      <>
        <FieldFrame isPending>
          <Input aria-label="Pending" />
        </FieldFrame>
        <FieldFrame isPending isSuccess>
          <Input aria-label="Done" />
        </FieldFrame>
      </>
    );

    const pending = statusSvgs(fieldRootFrom("Pending"));
    expect(pending).toHaveLength(2);
    const pendingShown = pending.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(pendingShown).toHaveLength(1);
    const pendingFace = pendingShown[0];
    if (!(pendingFace instanceof SVGElement)) {
      throw new Error("expected the pending face");
    }
    expect(getComputedStyle(pendingFace).animationName).not.toBe("none");

    const done = statusSvgs(fieldRootFrom("Done"));
    expect(done).toHaveLength(2);
    const doneShown = done.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(doneShown).toHaveLength(1);
    const doneFace = doneShown[0];
    if (!(doneFace instanceof SVGElement)) {
      throw new Error("expected the success face");
    }
    expect(getComputedStyle(doneFace).animationName).toBe("none");
  });

  it("groups the control with the description only when a content class is given", () => {
    renderThemed(
      <>
        <FieldFrame label="Email" description="Grouped." classNames={{ content: "flex flex-row" }}>
          <Input />
        </FieldFrame>
        <FieldFrame label="Phone" description="Ungrouped.">
          <Input />
        </FieldFrame>
      </>
    );
    const description = page.getByText("Grouped.").element();
    const wrapper = description.parentElement;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error("expected a content wrapper");
    }
    expect(wrapper.contains(textboxNamed("Email"))).toBe(true);
    expect(getComputedStyle(wrapper).display).toBe("flex");
    expect(getComputedStyle(wrapper).flexDirection).toBe("row");

    expect(page.getByText("Ungrouped.").element().parentElement).toBe(fieldRootFrom("Phone"));
  });

  it("renders Field.Set and Field.Legend when heading is legend", () => {
    renderThemed(
      <FieldFrame heading="legend" label="Options" description="Pick one." errorMessage="Required" invalid>
        <Input aria-label="Choice" />
      </FieldFrame>
    );

    const group = roleNamed("group", "Options");
    expect(group.tagName).toBe("FIELDSET");
    expect(page.getByText("Options", { exact: true }).element().textContent).toBe("Options");
    expect(page.getByRole("alert").element().textContent).toBe("Required");
    expect(nestedOrientationStamps(fieldRootFrom("Choice"))).toHaveLength(0);

    // The legend description renders before the options.
    const description = page.getByText("Pick one.").element();
    const control = page.getByRole("textbox", { name: "Choice", exact: true }).element();
    expect(description.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("renders one Field.Root per labeled composite so the nested-root trap cannot return", () => {
    const { host } = renderThemed(
      withLocale(
        "en-US",
        <>
          <TextField label="Email" />
          <NumberField label="Quantity" />
          <TextareaField label="Notes" />
          <PhoneNumberField label="Phone" />
          <CheckboxGroup label="Checks">
            <CheckboxItem value="a">Check member</CheckboxItem>
          </CheckboxGroup>
          <RadioGroup label="Radios">
            <Radio value="a">Radio member</Radio>
          </RadioGroup>
        </>
      )
    );

    const named = [
      fieldRootFrom("Email"),
      fieldRootFrom("Quantity"),
      fieldRootFrom("Notes"),
      fieldRootFrom("Phone"),
      roleNamed("group", "Checks").closest("[data-orientation]"),
      roleNamed("radiogroup", "Radios").closest("[data-orientation]"),
    ];
    for (const root of named) {
      if (!(root instanceof HTMLElement)) {
        throw new Error("expected a field root");
      }
      expect(nestedOrientationStamps(root)).toHaveLength(0);
    }
    expect(host.querySelectorAll("[data-orientation]")).toHaveLength(6);
  });

  describe.each(DENSITIES)("group spacing at %s density", (density) => {
    it.each(GROUPS)("puts the $name description directly under its label", ({ render }) => {
      stampDensity(density);
      const { host } = renderThemed(
        <>
          {preflightBoxReset}
          {render({ label: "Group", description: "Pick any." })}
        </>
      );
      const legend = textNamed("Group");
      const description = textNamed("Pick any.");

      expect(verticalGap(legend, description)).toBeCloseTo(LEGEND_TO_DESCRIPTION_PX, 0);
      expect(verticalGap(description, optionsIn(host))).toBeCloseTo(DESCRIPTION_TO_OPTIONS_PX, 0);
    });

    it.each(GROUPS)("keeps the $name label-to-options gap without a description", ({ render }) => {
      stampDensity(density);
      const { host } = renderThemed(
        <>
          {preflightBoxReset}
          {render({ label: "Group" })}
        </>
      );

      expect(verticalGap(textNamed("Group"), optionsIn(host))).toBeCloseTo(LEGEND_TO_OPTIONS_PX, 0);
    });

    it.each(GROUPS)("starts an unlabeled $name at its description", ({ render }) => {
      stampDensity(density);
      const { host } = renderThemed(
        <>
          {preflightBoxReset}
          {render({ description: "Pick any." })}
        </>
      );
      const description = textNamed("Pick any.");

      expect(description.getBoundingClientRect().top - contentBoxTop(fieldsetIn(host))).toBeCloseTo(0, 0);
      expect(verticalGap(description, optionsIn(host))).toBeCloseTo(DESCRIPTION_TO_OPTIONS_PX, 0);
    });

    it.each(GROUPS)("starts a $name with a hidden label at its description", ({ render }) => {
      stampDensity(density);
      const { host } = renderThemed(
        <>
          {preflightBoxReset}
          {render({ label: "Group", description: "Pick any.", isLabelHidden: true })}
        </>
      );
      const description = textNamed("Pick any.");

      // The hidden legend is out of flow, so nothing above the description is left to cancel.
      expect(description.getBoundingClientRect().top - contentBoxTop(fieldsetIn(host))).toBeCloseTo(0, 0);
      expect(verticalGap(description, optionsIn(host))).toBeCloseTo(DESCRIPTION_TO_OPTIONS_PX, 0);
    });

    it("keeps the group gap under an unlabeled pending RadioGroup's spinner row", () => {
      stampDensity(density);
      const { host } = renderThemed(
        <>
          {preflightBoxReset}
          <RadioGroup isPending description="Pick one.">
            <Radio value="a">Option</Radio>
          </RadioGroup>
        </>
      );
      const [spinner] = statusSvgs(host);
      // The spinner is the row's only child, centred, and sets the row's height.
      const statusRow = spinner?.parentElement;
      if (statusRow == null) {
        throw new Error("expected the pending spinner's heading row");
      }

      expect(verticalGap(statusRow, textNamed("Pick one."))).toBeCloseTo(STATUS_ROW_TO_DESCRIPTION_PX, 0);
    });

    it("leaves a TextField's label-to-control gap alone", () => {
      stampDensity(density);
      renderThemed(
        <>
          {preflightBoxReset}
          <TextField label="Email" description="Work address." />
        </>
      );
      expect(verticalGap(textNamed("Email"), textboxNamed("Email"))).toBeCloseTo(
        TEXT_FIELD_LABEL_TO_CONTROL_PX,
        0
      );
    });
  });
});

describe("isLabelHidden", () => {
  // The legend stays the group's name but leaves the layout: an sr-only box is 1px
  // square and absolute, so the group starts where the heading row was.
  it.each(labelHiddenCases)(
    "keeps $part named by a visually hidden legend with no heading row",
    ({ Group, Member, slot }) => {
      renderThemed(
        <>
          <Group label="Hidden options" isLabelHidden>
            <Member value="first">Hidden first</Member>
          </Group>
          <Group label="Shown options">
            <Member value="first">Shown first</Member>
          </Group>
        </>
      );

      const hidden = legendFieldset("Hidden options");
      assertLabelHiddenLayout(hidden, groupBody(hidden, slot));
      const shown = legendFieldset("Shown options");
      assertLabelShownLayout(shown, groupBody(shown, slot));
    }
  );
});
