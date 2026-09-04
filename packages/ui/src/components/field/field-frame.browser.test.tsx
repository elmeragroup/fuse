import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { CheckboxGroup, CheckboxItem } from "../checkbox/checkbox";
import { Input } from "../input/input";
import { NumberField } from "../number-field/number-field";
import { PhoneNumberField } from "../phone-number-field/phone-number-field";
import { Radio, RadioGroup } from "../radio-group/radio-group";
import { TextField } from "../text-field/text-field";
import { TextareaField } from "../textarea-field/textarea-field";
import { FieldFrame } from "./field-frame";

function fieldRootFrom(name: string): HTMLElement {
  const root = textboxNamed(name).closest("[data-slot=field]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected field root around ${name}`);
  }
  return root;
}

function statusSvgs(root: HTMLElement): SVGElement[] {
  return [...root.querySelectorAll("svg")];
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
    expect(fieldRootFrom("Bare").querySelector("label")).toBeNull();
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
    expect(pendingShown[0]?.classList.contains("animate-spin")).toBe(true);

    const done = statusSvgs(fieldRootFrom("Done"));
    expect(done).toHaveLength(2);
    const doneShown = done.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(doneShown).toHaveLength(1);
    expect(doneShown[0]?.classList.contains("animate-spin")).toBe(false);
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
    expect(wrapper.className).toContain("flex");
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

    const group = page.getByRole("group", { name: "Options", exact: true }).element();
    expect(group.tagName).toBe("FIELDSET");
    expect(group.querySelector("[data-slot=field-legend]")?.textContent).toBe("Options");
    expect(page.getByRole("alert").element().textContent).toBe("Required");
    expect(fieldRootFrom("Choice").querySelectorAll("[data-slot=field]")).toHaveLength(0);
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
    expect(root.querySelector("[data-slot=field-legend]")).toBeNull();
    expect(root.querySelector("label")).toBeNull();
    expect(page.getByText("busy").query()).toBeTruthy();
  });

  it("renders one Field.Root per labeled composite so the nested-root trap cannot return", () => {
    renderThemed(
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
      page.getByRole("group", { name: "Checks", exact: true }).element().closest("[data-slot=field]"),
      page.getByRole("radiogroup", { name: "Radios", exact: true }).element().closest("[data-slot=field]"),
    ];
    for (const root of named) {
      if (!(root instanceof HTMLElement)) {
        throw new Error("expected a field root");
      }
      expect(root.querySelectorAll("[data-slot=field]")).toHaveLength(0);
    }
    expect(document.querySelectorAll("[data-slot=field]")).toHaveLength(6);
  });
});
