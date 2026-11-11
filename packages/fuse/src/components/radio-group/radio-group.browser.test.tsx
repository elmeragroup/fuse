import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  effectiveOpacity,
  formNamed,
  renderThemed,
  textNamed,
} from "../../../test/themed-browser-render";
import { Badge } from "../badge/badge";
import { Field } from "../field";
import { Radio, RadioGroup, RadioGroupItem, RadioIconButton } from "./radio-group";

function radioNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("radio", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected radio named ${name}`);
  }
  return element;
}

function radiogroupNamed(name: string): HTMLElement {
  const element = page.getByRole("radiogroup", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected radiogroup named ${name}`);
  }
  return element;
}

function groupHosting(control: HTMLElement): HTMLElement {
  const group = page
    .getByRole("group")
    .elements()
    .find((element) => element.contains(control));
  if (!(group instanceof HTMLElement)) {
    throw new Error("expected a group around the radiogroup");
  }
  return group;
}

function namedGroupHosting(control: HTMLElement): HTMLElement | null {
  const match = page
    .getByRole("group", { name: /.+/ })
    .elements()
    .find((element) => element.contains(control));
  return match instanceof HTMLElement ? match : null;
}

function Glyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" />
    </svg>
  );
}

describe("RadioGroup", () => {
  it("exposes members through the legend name and calls onChange with a string from a label click", async () => {
    const onChange = vi.fn();
    renderThemed(
      <RadioGroup label="Contract" description="Choose a plan." onChange={onChange}>
        <Radio value="fixed">Fixed</Radio>
        <Radio value="spot">Spot</Radio>
      </RadioGroup>
    );

    expect(radiogroupNamed("Contract")).toBeTruthy();
    expect(radioNamed("Fixed", false).getAttribute("aria-checked")).toBe("false");
    // The whole row label is the click target, its text included.
    await userEvent.click(textNamed("Fixed"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toBe("fixed");
    expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps a member's Field label when a wrapper forwards id and aria-labelledby as undefined", () => {
    renderThemed(
      <RadioGroup label="Contract">
        <Field.Item>
          <Field.Label>
            <RadioGroupItem value="fixed" id={undefined} aria-labelledby={undefined} />
            Fixed
          </Field.Label>
        </Field.Item>
      </RadioGroup>
    );
    expect(radioNamed("Fixed", false).getAttribute("data-slot")).toBe("radio-group-item");
  });

  it("keeps a controlled string value when clicks have no onChange feedback", async () => {
    renderThemed(
      <RadioGroup label="Contract" value="fixed">
        <Radio value="fixed">Fixed</Radio>
        <Radio value="spot">Spot</Radio>
      </RadioGroup>
    );

    expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(page.getByRole("radio", { name: "Spot", exact: true }));
    expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
    expect(radioNamed("Spot", false).getAttribute("aria-checked")).toBe("false");
  });

  it("transitions a controlled string value to null without an uncontrolled warning", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function ControlledGroup() {
      const [value, setValue] = useState<string | null>("fixed");
      return (
        <>
          <RadioGroup label="Contract" value={value}>
            <Radio value="fixed">Fixed</Radio>
            <Radio value="spot">Spot</Radio>
          </RadioGroup>
          <button type="button" onClick={() => setValue(null)}>
            Clear contract
          </button>
        </>
      );
    }

    try {
      renderThemed(<ControlledGroup />);
      expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
      expect(radioNamed("Spot", false).getAttribute("aria-checked")).toBe("false");

      await userEvent.click(page.getByRole("button", { name: "Clear contract", exact: true }));

      expect(radioNamed("Fixed", false).getAttribute("aria-checked")).toBe("false");
      expect(radioNamed("Spot", false).getAttribute("aria-checked")).toBe("false");
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("moves selection with arrows, wraps, skips disabled, and Tabs out of the group", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <RadioGroup label="Contract" defaultValue="fixed">
          <Radio value="fixed">Fixed</Radio>
          <Radio value="spot" isDisabled>
            Spot
          </Radio>
          <Radio value="hourly">Hourly</Radio>
        </RadioGroup>
        <button type="button">After</button>
      </>
    );

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(radioNamed("Fixed", true));

    await userEvent.keyboard("{ArrowDown}");
    expect(radioNamed("Hourly", true).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radioNamed("Hourly", true));
    expect(radioNamed("Spot").getAttribute("aria-checked")).toBe("false");

    await userEvent.keyboard("{ArrowDown}");
    expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radioNamed("Fixed", true));

    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After", exact: true }).element());
  });

  it("renders no legend row for isPending={false} without a label, and a decorative spinner when pending", () => {
    renderThemed(
      <>
        <RadioGroup isPending={false}>
          <Radio value="fixed">Bare fixed</Radio>
        </RadioGroup>
        <RadioGroup isPending>
          <Radio value="fixed">Pending unlabeled</Radio>
        </RadioGroup>
        <RadioGroup label="Contract" isPending>
          <Radio value="fixed">Pending fixed</Radio>
        </RadioGroup>
      </>
    );

    const unnamed = page.getByRole("radiogroup").elements();
    const bare = unnamed.find((element) => element.contains(radioNamed("Bare fixed")));
    if (!(bare instanceof HTMLElement)) {
      throw new Error("expected the unlabeled radiogroup");
    }
    expect(bare.getAttribute("aria-labelledby")).toBeFalsy();
    expect(namedGroupHosting(bare)).toBeNull();
    expect(groupHosting(bare)).toBeTruthy();
    expect(bare.previousElementSibling).toBeNull();
    expect(bare.hasAttribute("aria-busy")).toBe(false);

    const pendingUnlabeled = unnamed.find((element) => element.contains(radioNamed("Pending unlabeled")));
    if (!(pendingUnlabeled instanceof HTMLElement)) {
      throw new Error("expected the unlabeled pending radiogroup");
    }
    expect(pendingUnlabeled.getAttribute("aria-labelledby")).toBeFalsy();
    expect(pendingUnlabeled.getAttribute("aria-busy")).toBe("true");
    expect(namedGroupHosting(pendingUnlabeled)).toBeNull();
    if (!(pendingUnlabeled.previousElementSibling instanceof HTMLElement)) {
      throw new Error("expected a pending status row without a legend");
    }

    const pendingGroup = radiogroupNamed("Contract");
    expect(page.getByRole("group", { name: "Contract", exact: true }).query()).not.toBeNull();
    expect(namedGroupHosting(pendingGroup)?.textContent).toContain("Contract");
    if (!(pendingGroup.previousElementSibling instanceof HTMLElement)) {
      throw new Error("expected a pending status row beside the legend");
    }
    expect(page.getByRole("img").query()).toBeNull();
    expect(page.getByRole("status").query()).toBeNull();
  });

  it("renders a ReactNode error as role=alert and stamps invalid on items", () => {
    renderThemed(
      <>
        <RadioGroup label="Valid contract" defaultValue="fixed">
          <Radio value="fixed">Valid fixed</Radio>
        </RadioGroup>
        <RadioGroup
          label="Contract"
          isInvalid
          defaultValue="fixed"
          errorMessage={<a href="#help">Fix contract</a>}>
          <Radio value="fixed">Fixed</Radio>
          <Radio value="spot">Spot</Radio>
        </RadioGroup>
      </>
    );

    const alert = page.getByRole("alert").element();
    expect(page.getByRole("link", { name: "Fix contract", exact: true }).element().parentElement).toBe(alert);
    const fixed = radioNamed("Fixed", true);
    expect(fixed.getAttribute("aria-invalid")).toBe("true");
    expect(fixed.hasAttribute("data-invalid")).toBe(true);
    expect(radioNamed("Spot", false).getAttribute("aria-invalid")).toBe("true");
    expect(getComputedStyle(fixed).borderTopColor).toBe(cssVarColor(fixed, "--primary"));
    expect(getComputedStyle(radioNamed("Spot", false)).borderTopColor).toBe(cssVarColor(fixed, "--error"));
  });

  it("forwards readOnly, required, and name onto the primitive and hidden input", async () => {
    const submitted: Array<FormDataEntryValue | null> = [];
    renderThemed(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get("contract"));
        }}>
        <RadioGroup name="contract" label="Contract" defaultValue="fixed" isReadOnly isRequired>
          <Radio value="fixed">Fixed</Radio>
          <Radio value="spot">Spot</Radio>
        </RadioGroup>
        <button type="submit">Save</button>
      </form>
    );

    const group = radiogroupNamed("Contract");
    expect(group.getAttribute("aria-readonly")).toBe("true");
    expect(group.getAttribute("aria-required")).toBe("true");
    await userEvent.click(page.getByRole("radio", { name: "Spot", exact: true }));
    expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
    expect(radioNamed("Spot", false).getAttribute("aria-checked")).toBe("false");

    const hidden = group.parentElement?.querySelector('input[name="contract"]');
    expect(hidden).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    expect(submitted).toEqual(["fixed"]);
  });

  it("submits each group's shown selection after native reset, controlled or not, and keeps focus", async () => {
    function View() {
      const [value, setValue] = useState("list");
      return (
        <RadioGroup label="View" name="view" value={value} onChange={setValue}>
          <RadioIconButton value="list" aria-label="List">
            <Glyph />
          </RadioIconButton>
          <RadioIconButton value="house" aria-label="Home">
            <Glyph />
          </RadioIconButton>
        </RadioGroup>
      );
    }
    renderThemed(
      <form aria-label="Plan form">
        <RadioGroup label="Contract" name="contract" defaultValue="fixed">
          <Radio value="fixed">Fixed</Radio>
          <Radio value="spot">Spot</Radio>
        </RadioGroup>
        <View />
      </form>
    );
    await userEvent.click(radioNamed("Spot"));
    await userEvent.click(radioNamed("Home"));

    formNamed("Plan form").reset();
    await vi.waitFor(() => {
      expect([...new FormData(formNamed("Plan form")).entries()]).toEqual([
        ["contract", "spot"],
        ["view", "house"],
      ]);
    });
    expect(radioNamed("Spot").getAttribute("aria-checked")).toBe("true");
    expect(radioNamed("Home").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radioNamed("Home"));
  });
});

describe("Radio", () => {
  it("lays out rich label content in the label's row and dims a disabled row's control and content once each", () => {
    renderThemed(
      <RadioGroup label="Contract">
        <Radio value="spot" isDisabled>
          Spot <Badge>New</Badge>
        </Radio>
        <Radio value="fixed">Fixed</Radio>
      </RadioGroup>
    );

    const badge = textNamed("New");
    const text = badge.parentElement?.firstChild;
    if (!(text instanceof Text)) {
      throw new Error("expected the label text before the badge");
    }
    const range = document.createRange();
    range.selectNodeContents(text);
    const textBox = range.getBoundingClientRect();
    const badgeBox = badge.getBoundingClientRect();

    // The label row puts gap-2 (8px) between the text and the badge and centers both. One
    // inline run would collapse the gap to a space and align the badge to the baseline.
    expect(badgeBox.left - textBox.right).toBeCloseTo(8, 0);
    const offCenter = badgeBox.top + badgeBox.height / 2 - (textBox.top + textBox.height / 2);
    expect(Math.abs(offCenter)).toBeLessThanOrEqual(1);
    // The control dims itself and the label dims only its content, so neither compounds.
    expect(effectiveOpacity(radioNamed("Spot New"))).toBe(0.5);
    expect(effectiveOpacity(badge)).toBe(0.5);
    expect(effectiveOpacity(radioNamed("Fixed"))).toBe(1);
    expect(effectiveOpacity(textNamed("Fixed"))).toBe(1);
  });
});

describe("RadioIconButton", () => {
  it("selects via click within a group", async () => {
    const onChange = vi.fn();
    renderThemed(
      <RadioGroup label="View" defaultValue="list" onChange={onChange}>
        <RadioIconButton value="list" aria-label="List">
          <Glyph />
        </RadioIconButton>
        <RadioIconButton value="house" aria-label="Home">
          <Glyph />
        </RadioIconButton>
      </RadioGroup>
    );

    expect(radioNamed("List", true).getAttribute("data-slot")).toBe("radio-icon-button");
    await userEvent.click(page.getByRole("radio", { name: "Home", exact: true }));
    expect(onChange).toHaveBeenCalledWith("house");
    expect(radioNamed("Home", true).getAttribute("aria-checked")).toBe("true");
    expect(radioNamed("List", false).getAttribute("aria-checked")).toBe("false");
  });
});
