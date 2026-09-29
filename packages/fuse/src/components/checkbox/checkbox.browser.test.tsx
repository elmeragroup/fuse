import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { cssVarColor, headingNamed, renderThemed } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { Checkbox, CheckboxDescription, CheckboxGroup } from "./checkbox";
import { CheckboxItem } from "./checkbox-item";

function checkboxNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("checkbox", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox named ${name}`);
  }
  return element;
}

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected group named ${name}`);
  }
  return element;
}

describe("Checkbox", () => {
  it("keeps the Field label and description when a wrapper forwards id and ARIA props as undefined", async () => {
    renderThemed(
      <Field.Root orientation="horizontal">
        <Checkbox id={undefined} aria-labelledby={undefined} aria-describedby={undefined} />
        <Field.Label>Accept terms</Field.Label>
        <Field.Description>Required to continue.</Field.Description>
      </Field.Root>
    );
    await expect.element(checkboxNamed("Accept terms")).toHaveAccessibleDescription("Required to continue.");
  });

  it("toggles from Tab focus with Space", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Field.Root orientation="horizontal">
          <Checkbox />
          <Field.Label>Alerts</Field.Label>
        </Field.Root>
      </>
    );

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(checkboxNamed("Alerts", false));
    expect(checkboxNamed("Alerts").getAttribute("data-slot")).toBe("checkbox");
    expect(checkboxNamed("Alerts").getAttribute("aria-checked")).toBe("false");
    await userEvent.keyboard(" ");
    expect(checkboxNamed("Alerts", true).getAttribute("aria-checked")).toBe("true");
  });

  it("blocks toggling when disabled", async () => {
    const onCheckedChange = vi.fn();
    renderThemed(
      <Field.Root orientation="horizontal">
        <Checkbox disabled onCheckedChange={onCheckedChange} />
        <Field.Label>Alerts</Field.Label>
      </Field.Root>
    );

    const box = checkboxNamed("Alerts", false);
    await expect.element(page.getByRole("checkbox", { name: "Alerts", exact: true })).toBeDisabled();
    box.click();
    await userEvent.keyboard(" ");
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(checkboxNamed("Alerts", false).getAttribute("aria-checked")).toBe("false");
  });

  it("renders readOnly without changing on click", async () => {
    renderThemed(
      <Field.Root orientation="horizontal">
        <Checkbox readOnly />
        <Field.Label>Locked</Field.Label>
      </Field.Root>
    );

    const box = checkboxNamed("Locked", false);
    expect(box.getAttribute("aria-readonly")).toBe("true");
    await userEvent.click(page.getByRole("checkbox", { name: "Locked", exact: true }));
    expect(checkboxNamed("Locked", false).getAttribute("aria-checked")).toBe("false");
  });

  it("toggles when clicked 8px outside the painted box", async () => {
    renderThemed(
      <div className="p-8">
        <Checkbox aria-label="Hit" />
      </div>
    );

    const box = checkboxNamed("Hit", false);
    const rect = box.getBoundingClientRect();
    const x = rect.right + 8;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    expect(hit === box || (hit instanceof Node && box.contains(hit))).toBe(true);
    if (!(hit instanceof Element)) {
      throw new Error("expected a hit target 8px outside the painted box");
    }
    await userEvent.click(hit);
    expect(checkboxNamed("Hit", true).getAttribute("aria-checked")).toBe("true");
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Field.Root orientation="horizontal">
          <Checkbox />
          <Field.Label>Alerts</Field.Label>
        </Field.Root>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingAtBothDensities(previous, checkboxNamed("Alerts"));
  });
});

describe("CheckboxGroup", () => {
  it("exposes members through the legend name and calls onChange with string[]", async () => {
    const onChange = vi.fn();
    renderThemed(
      <CheckboxGroup label="Toppings" description="Choose extras." onChange={onChange}>
        <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
        <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
      </CheckboxGroup>
    );

    expect(groupNamed("Toppings")).toBeTruthy();
    expect(checkboxNamed("Pepperoni", false).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(page.getByRole("checkbox", { name: "Pepperoni", exact: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(["pepperoni"]);
    expect(checkboxNamed("Pepperoni", true).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps a controlled value when clicks have no onChange feedback", async () => {
    renderThemed(
      <CheckboxGroup label="Toppings" value={["pepperoni"]}>
        <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
        <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
      </CheckboxGroup>
    );

    expect(checkboxNamed("Pepperoni", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Mushroom", false).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(page.getByRole("checkbox", { name: "Mushroom", exact: true }));
    expect(checkboxNamed("Pepperoni", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Mushroom", false).getAttribute("aria-checked")).toBe("false");
  });

  it("reports mixed on a parent when two of three members are checked, then checks and unchecks all", async () => {
    renderThemed(
      <CheckboxGroup label="Toppings" allValues={["a", "b", "c"]} defaultValue={["a", "b"]}>
        <CheckboxItem parent>All toppings</CheckboxItem>
        <CheckboxItem value="a">Pepperoni</CheckboxItem>
        <CheckboxItem value="b">Mushroom</CheckboxItem>
        <CheckboxItem value="c">Olive</CheckboxItem>
      </CheckboxGroup>
    );

    expect(checkboxNamed("All toppings").getAttribute("aria-checked")).toBe("mixed");
    await userEvent.click(page.getByRole("checkbox", { name: "All toppings", exact: true }));
    expect(checkboxNamed("All toppings", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Pepperoni", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Mushroom", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Olive", true).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(page.getByRole("checkbox", { name: "All toppings", exact: true }));
    expect(checkboxNamed("All toppings", false).getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Pepperoni", false).getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Mushroom", false).getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Olive", false).getAttribute("aria-checked")).toBe("false");
  });

  it("renders a ReactNode error as role=alert and stamps invalid on members", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Valid toppings" defaultValue={["pepperoni"]}>
          <CheckboxItem value="pepperoni">Valid pepperoni</CheckboxItem>
        </CheckboxGroup>
        <CheckboxGroup
          label="Toppings"
          isInvalid
          defaultValue={["pepperoni"]}
          errorMessage={<a href="#help">Fix toppings</a>}>
          <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
          <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
        </CheckboxGroup>
      </>
    );

    const alert = page.getByRole("alert").element();
    expect(page.getByRole("link", { name: "Fix toppings", exact: true }).element().parentElement).toBe(alert);
    const pepperoni = checkboxNamed("Pepperoni", true);
    expect(pepperoni.getAttribute("aria-invalid")).toBe("true");
    expect(pepperoni.hasAttribute("data-invalid")).toBe(true);
    expect(checkboxNamed("Mushroom", false).getAttribute("aria-invalid")).toBe("true");
    expect(getComputedStyle(pepperoni).borderTopColor).toBe(cssVarColor(pepperoni, "--primary"));
    expect(getComputedStyle(checkboxNamed("Mushroom", false)).borderTopColor).toBe(
      cssVarColor(pepperoni, "--error")
    );
  });

  it("threads the Field name onto member hidden inputs", async () => {
    const submitted: string[][] = [];
    renderThemed(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).getAll("toppings").map(String));
        }}>
        <CheckboxGroup name="toppings" label="Toppings" defaultValue={["pepperoni"]}>
          <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
          <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
        </CheckboxGroup>
        <button type="submit">Save</button>
      </form>
    );

    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    expect(submitted).toEqual([["pepperoni"]]);
  });
});

describe("CheckboxItem", () => {
  it("toggles from the row and isolates SubSection clicks", async () => {
    renderThemed(
      <CheckboxGroup label="Plans">
        <CheckboxItem value="fixed">
          <CheckboxItem.Title role="heading" aria-level={3}>
            Fixed price
          </CheckboxItem.Title>
          <CheckboxItem.SubSection>
            <button type="button">Details</button>
          </CheckboxItem.SubSection>
        </CheckboxItem>
      </CheckboxGroup>
    );

    const details = page.getByRole("button", { name: "Details", exact: true }).element();
    expect(details.closest("label")).toBeNull();
    expect(page.getByRole("listitem").elements()).toHaveLength(0);
    await userEvent.click(headingNamed("Fixed price"));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(page.getByRole("button", { name: "Details", exact: true }));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });
});

describe("CheckboxDescription", () => {
  it("keeps a string note visual-only and renders a ReactNode intact", () => {
    renderThemed(
      <>
        <CheckboxDescription describedBy="Optional extras">
          <Field.Root>
            <Field.Label>Pepperoni</Field.Label>
            <Checkbox />
          </Field.Root>
        </CheckboxDescription>
        <CheckboxDescription describedBy={<a href="#help">Read the note</a>}>
          <Field.Root>
            <Field.Label>Mushroom</Field.Label>
            <Checkbox />
          </Field.Root>
        </CheckboxDescription>
      </>
    );

    expect(checkboxNamed("Pepperoni").getAttribute("aria-describedby")).toBeNull();
    expect(page.getByRole("link", { name: "Read the note", exact: true }).element()).toBeTruthy();
  });
});
