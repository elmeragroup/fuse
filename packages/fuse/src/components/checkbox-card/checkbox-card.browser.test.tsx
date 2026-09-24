import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { CheckboxGroup } from "../checkbox/checkbox";
import { CheckboxCard } from "./checkbox-card";

function checkboxNamed(name: string, checked?: boolean): HTMLElement {
  // Substring match on purpose: the card's accessible name appends the description/tags.
  const element = page.getByRole("checkbox", { name, checked, exact: false }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox named ${name}`);
  }
  return element;
}

function labelFor(name: string): HTMLLabelElement {
  const label = checkboxNamed(name).closest("label");
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error(`expected a label associated with ${name}`);
  }
  return label;
}

function cardSurface(name: string): HTMLElement {
  const content = labelFor(name).parentElement;
  const root = content?.parentElement;
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected a card surface around ${name}`);
  }
  return root;
}

function fieldItemFor(name: string): HTMLElement {
  const item = cardSurface(name).parentElement;
  if (!(item instanceof HTMLElement)) {
    throw new Error(`expected a Field item wrapping ${name}`);
  }
  return item;
}

function indicatorSvgs(name: string): [SVGElement, SVGElement] {
  const svgs = [...checkboxNamed(name).querySelectorAll("svg")];
  const first = svgs[0];
  const second = svgs[1];
  if (first === undefined || second === undefined || svgs.length !== 2) {
    throw new Error(`expected two indicator icons inside ${name}`);
  }
  return [first, second];
}

describe("CheckboxCard", () => {
  it("renders a checkbox whose accessible name comes from the title", () => {
    renderThemed(
      <CheckboxGroup>
        <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />
      </CheckboxGroup>
    );

    const box = checkboxNamed("Insurance", false);
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(fieldItemFor("Insurance").getAttribute("data-slot")).toBeNull();
  });

  it("toggles from the title and description and isolates rightContent clicks", async () => {
    renderThemed(
      <CheckboxGroup>
        <CheckboxCard
          value="insurance"
          title="Insurance"
          description="Covers everything."
          rightContent={<button type="button">Details</button>}
        />
      </CheckboxGroup>
    );

    const details = page.getByRole("button", { name: "Details", exact: true }).element();
    expect(details.closest("label")).toBeNull();

    await userEvent.click(page.getByText("Insurance", { exact: true }));
    expect(checkboxNamed("Insurance", true).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(page.getByText("Covers everything.", { exact: true }));
    expect(checkboxNamed("Insurance", false).getAttribute("aria-checked")).toBe("false");

    await userEvent.click(page.getByRole("button", { name: "Details", exact: true }));
    expect(checkboxNamed("Insurance", false).getAttribute("aria-checked")).toBe("false");
  });

  it("toggles from Tab focus with Space and skips a disabled card", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <CheckboxGroup>
          <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />
          <CheckboxCard value="roadside" title="Roadside" description="Towing included." isDisabled />
        </CheckboxGroup>
      </>
    );

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(checkboxNamed("Insurance", false));
    await userEvent.keyboard(" ");
    expect(checkboxNamed("Insurance", true).getAttribute("aria-checked")).toBe("true");

    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).not.toBe(checkboxNamed("Roadside", false));
    await expect.element(page.getByRole("checkbox", { name: "Roadside", exact: false })).toBeDisabled();
    checkboxNamed("Roadside").click();
    await userEvent.keyboard(" ");
    expect(checkboxNamed("Roadside", false).getAttribute("aria-checked")).toBe("false");
  });

  it("keeps a controlled group value when clicks have no onChange feedback", async () => {
    renderThemed(
      <CheckboxGroup label="Add-ons" value={["insurance"]}>
        <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />
        <CheckboxCard value="roadside" title="Roadside" description="Towing included." />
      </CheckboxGroup>
    );

    expect(checkboxNamed("Insurance", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Roadside", false).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(page.getByRole("checkbox", { name: "Roadside", exact: false }));
    expect(checkboxNamed("Insurance", true).getAttribute("aria-checked")).toBe("true");
    expect(checkboxNamed("Roadside", false).getAttribute("aria-checked")).toBe("false");
  });

  it("renders tags as badges and omits the tag row when tags are empty", () => {
    renderThemed(
      <CheckboxGroup>
        <CheckboxCard
          value="insurance"
          title="Insurance"
          description="Covers everything."
          tags={["Popular"]}
        />
        <CheckboxCard value="roadside" title="Roadside" description="Towing included." tags={[]} />
      </CheckboxGroup>
    );

    expect(page.getByText("Popular", { exact: true }).element()).toBeTruthy();
    expect(labelFor("Insurance").textContent).toContain("Popular");
    expect(labelFor("Roadside").textContent).not.toContain("Popular");
  });

  it("reflects muted and disabled in computed card surface styles", () => {
    renderThemed(
      <CheckboxGroup>
        <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />
        <CheckboxCard value="muted" title="Muted plan" description="Quiet surface." variant="muted" />
        <CheckboxCard value="disabled" title="Disabled plan" description="Cannot be selected." isDisabled />
      </CheckboxGroup>
    );

    const insurance = cardSurface("Insurance");
    const muted = cardSurface("Muted plan");
    const disabled = cardSurface("Disabled plan");
    expect(getComputedStyle(insurance).backgroundColor).toBe(cssVarColor(insurance, "--card"));
    expect(getComputedStyle(muted).backgroundColor).toBe(cssVarColor(muted, "--muted"));
    expect(getComputedStyle(disabled).opacity).toBe("0.5");
  });

  it("crossfades the indicator icons with checked state", async () => {
    renderThemed(
      <CheckboxGroup>
        <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />
      </CheckboxGroup>
    );

    const [uncheckedCircle, uncheckedCheck] = indicatorSvgs("Insurance");
    expect(getComputedStyle(uncheckedCircle).opacity).toBe("1");
    expect(getComputedStyle(uncheckedCheck).opacity).toBe("0");

    await userEvent.click(page.getByRole("checkbox", { name: "Insurance", exact: false }));
    expect(checkboxNamed("Insurance", true).getAttribute("aria-checked")).toBe("true");
    await expect.poll(() => getComputedStyle(indicatorSvgs("Insurance")[0]).opacity).toBe("0");
    await expect.poll(() => getComputedStyle(indicatorSvgs("Insurance")[1]).opacity).toBe("1");
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <CheckboxGroup>
          <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />
        </CheckboxGroup>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingAtBothDensities(previous, checkboxNamed("Insurance"));
  });
});
