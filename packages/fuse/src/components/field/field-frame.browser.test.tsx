import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { fieldRootFrom, renderThemed, roleNamed, textboxNamed } from "../../../test/themed-browser-render";
import { CheckboxGroup, CheckboxItem } from "../checkbox/checkbox";
import { Input } from "../input/input";
import { NumberField } from "../number-field/number-field";
import { PhoneNumberField } from "../phone-number-field/phone-number-field";
import { Radio, RadioGroup } from "../radio-group/radio-group";
import { TextField } from "../text-field/text-field";
import { TextareaField } from "../textarea-field/textarea-field";
import { FieldFrame } from "./field-frame";

function statusSvgs(root: HTMLElement): SVGElement[] {
  return [...root.querySelectorAll("svg")];
}

function nestedOrientationStamps(root: HTMLElement): Element[] {
  return [...root.querySelectorAll("[data-orientation]")];
}

describe("FieldFrame", () => {
  it("names the control and links the description and the error", () => {
    renderThemed(
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
  });

  it("omits the error when the message is falsy", () => {
    renderThemed(
      <FieldFrame label="Email">
        <Input />
      </FieldFrame>
    );
    expect(page.getByRole("alert").query()).toBeNull();
  });

  it("omits the label row entirely when there is no label, status, or crossfade", () => {
    renderThemed(
      <FieldFrame description="Only a description.">
        <Input aria-label="Bare" />
      </FieldFrame>
    );
    expect(fieldRootFrom("Bare").querySelectorAll("label")).toHaveLength(0);
    expect(page.getByText("Only a description.").query()).toBeTruthy();
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

  it("groups the control with the description when a content class is given", () => {
    renderThemed(
      <FieldFrame label="Email" description="Grouped." classNames={{ content: "flex flex-row" }}>
        <Input />
      </FieldFrame>
    );
    const description = page.getByText("Grouped.").element();
    const wrapper = description.parentElement;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error("expected a content wrapper");
    }
    expect(wrapper.contains(textboxNamed("Email"))).toBe(true);
    expect(getComputedStyle(wrapper).display).toBe("flex");
    expect(getComputedStyle(wrapper).flexDirection).toBe("row");
  });

  it("leaves the control and the description as siblings without a content class", () => {
    renderThemed(
      <FieldFrame label="Email" description="Ungrouped.">
        <Input />
      </FieldFrame>
    );
    const description = page.getByText("Ungrouped.").element();
    expect(description.parentElement).toBe(fieldRootFrom("Email"));
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
  });

  it("renders the legend description before the options", () => {
    renderThemed(
      <FieldFrame heading="legend" label="Options" description="Pick one.">
        <Input aria-label="Choice" />
      </FieldFrame>
    );

    const description = page.getByText("Pick one.").element();
    const control = page.getByRole("textbox", { name: "Choice", exact: true }).element();
    expect(description.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("omits the legend element when heading is legend and there is no label", () => {
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
});
