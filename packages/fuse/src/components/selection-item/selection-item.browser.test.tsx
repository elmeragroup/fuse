import { Checkbox } from "@base-ui/react/checkbox";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertHorizontalItemList, radiusToken } from "../../../test/assert-selection-item-group-layout";
import { headingNamed, renderThemed, roleNamed, textNamed } from "../../../test/themed-browser-render";
import { disabledHatch } from "../../styles/utils";
import { Checkbox as UiCheckbox, CheckboxGroup, CheckboxItem, CheckboxItemGroup } from "../checkbox/checkbox";
import { Field } from "../field/field";
import { Radio, RadioGroup, RadioItem, RadioItemGroup } from "../radio-group/radio-group";
import { SelectionItem } from "./selection-item";

function checkboxNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("checkbox", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox named ${name}`);
  }
  return element;
}

function shellFrom(name: string): HTMLElement {
  const heading = headingNamed(name);
  const shell = heading.closest("[data-selection-item]");
  if (shell instanceof HTMLElement) {
    return shell;
  }
  const article = heading.closest("article");
  if (article instanceof HTMLElement) {
    return article;
  }
  throw new Error(`expected checkbox-item shell around ${name}`);
}

function controlSlot(shell: HTMLElement): HTMLElement {
  const control = [
    ...page.getByRole("checkbox").elements(),
    ...page.getByRole("radio").elements(),
    ...page.getByRole("img").elements(),
  ].find((element) => shell.contains(element));
  const media = control?.parentElement;
  if (!(media instanceof HTMLElement)) {
    throw new Error("expected selection-item-control slot");
  }
  return media;
}

function subsectionHost(from: HTMLElement): HTMLElement {
  const host = from.closest("[data-mode], [aria-hidden='true']");
  if (!(host instanceof HTMLElement)) {
    throw new Error("expected a subsection host");
  }
  return host;
}

function nestedSubsectionButton(label: string): HTMLElement {
  const button = subsectionHost(textNamed(label)).querySelector("button");
  if (!(button instanceof HTMLElement)) {
    throw new Error(`expected a button inside the ${label} subsection`);
  }
  return button;
}

function SubSectionTree({ mode }: { mode: "hidden" | "visible" | "default" }) {
  return (
    <>
      <button type="button">Before</button>
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<span role="img" aria-label="Indicator" />}>
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.SubSection mode={mode}>
            <button type="button">Hidden details</button>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
      <button type="button">After</button>
    </>
  );
}

function subsectionSpacer(label: string): HTMLElement {
  const footer = roleNamed("region", label).parentElement;
  let current = footer?.parentElement ?? null;
  while (current) {
    const spacer = [...current.children].find((child) => child.getAttribute("aria-hidden") === "true");
    if (spacer instanceof HTMLElement) {
      return spacer;
    }
    current = current.parentElement;
  }
  throw new Error(`expected aria-hidden subsection spacer beside ${label}`);
}

function tokenBorderColor(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = `border ${utility}`;
  host.append(probe);
  const color = getComputedStyle(probe).borderTopColor;
  probe.remove();
  return color;
}

function tokenBackgroundColor(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

function tokenBackgroundImage(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const image = getComputedStyle(probe).backgroundImage;
  probe.remove();
  return image;
}

function RowTitle({ children }: { children: string }) {
  return (
    <SelectionItem.Title role="heading" aria-level={3}>
      {children}
    </SelectionItem.Title>
  );
}

describe("SelectionItem", () => {
  it("renders data-slot from the dataSlot prop", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );
    expect(shellFrom("Fixed price").getAttribute("data-slot")).toBe("checkbox-item");
    expect(controlSlot(shellFrom("Fixed price")).getAttribute("data-slot")).toBe("selection-item-control");
    expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("false");
  });

  it("keeps data-slot on a render host", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />} render={<article />}>
          <RowTitle>Article row</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );
    const article = headingNamed("Article row").closest("article");
    expect(article?.getAttribute("data-slot")).toBe("checkbox-item");
  });

  it("toggles from row text and isolates subsection clicks", async () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <SelectionItem.Content>
            <RowTitle>Fixed price</RowTitle>
          </SelectionItem.Content>
          <SelectionItem.SubSection>
            <button type="button">Details</button>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const details = page.getByRole("button", { name: "Details", exact: true }).element();
    expect(details.closest("label")).toBeNull();

    await userEvent.click(headingNamed("Fixed price"));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(page.getByRole("button", { name: "Details", exact: true }));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps a Fragment-wrapped SubSection inside the label", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <>
            <SelectionItem.SubSection>
              <button type="button">Inside fragment</button>
            </SelectionItem.SubSection>
          </>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const button = page.getByRole("button", { name: "Inside fragment", exact: true }).element();
    expect(button.closest("label")).not.toBeNull();
    button.closest("label")?.click();
    const box = page.getByRole("checkbox", { checked: true }).element();
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("renders nothing for a childless SubSection", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.SubSection />
        </SelectionItem.Shell>
      </Field.Root>
    );
    expect(page.getByRole("region").query()).toBeNull();
    expect(page.getByRole("region", { name: "Hidden extra", exact: true }).query()).toBeNull();
  });

  it("makes hidden SubSection content unclickable", async () => {
    let extraClicks = 0;
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.SubSection mode="hidden">
            <button
              type="button"
              onClick={() => {
                extraClicks += 1;
              }}>
              Hidden details
            </button>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const detailsEl = nestedSubsectionButton("Hidden details");
    const footer = subsectionHost(detailsEl);
    expect(footer.getAttribute("data-mode")).toBe("hidden");
    expect(getComputedStyle(footer).pointerEvents).toBe("none");

    const box = detailsEl.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + Math.max(box.width, 1) / 2,
      box.top + Math.max(box.height, 1) / 2
    );
    expect(hit instanceof Node && detailsEl.contains(hit)).toBe(false);
    if (hit instanceof HTMLElement) {
      await userEvent.click(hit);
    }
    expect(extraClicks).toBe(0);
  });

  it("passes mode through to Item.Footer: hidden renders the band inert, visible does not", () => {
    // The focus choreography behind `inert` is Item.Footer's, covered in item.browser.test.tsx.
    const { rerender } = renderThemed(<SubSectionTree mode="hidden" />);
    expect(subsectionHost(nestedSubsectionButton("Hidden details")).inert).toBe(true);

    rerender(<SubSectionTree mode="visible" />);
    expect(subsectionHost(nestedSubsectionButton("Hidden details")).inert).toBe(false);
  });

  it("places the control after the row at end and matches spacer width in both positions", () => {
    renderThemed(
      <div>
        <Field.Root style={{ display: "contents" }}>
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Start row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="Start extra">
              Start extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
        <Field.Root style={{ display: "contents" }}>
          <SelectionItem.Shell dataSlot="checkbox-item" controlPosition="end" control={<Checkbox.Root />}>
            <RowTitle>End row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="End extra">
              End extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
        <Field.Root style={{ display: "contents" }}>
          <SelectionItem.Shell
            dataSlot="checkbox-item"
            controlPosition="end"
            control={
              // Inline, not utility classes: the browser suite loads `styles.css`, which is
              // compiled from `dist/**/*.js` only, so a class spelled solely in a test never
              // reaches the sheet.
              <span
                role="img"
                aria-label="Wide indicator"
                style={{ display: "block", height: "1rem", width: "3rem" }}
              />
            }>
            <RowTitle>Wide row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="Wide extra">
              Wide extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
      </div>
    );

    const start = shellFrom("Start row");
    const end = shellFrom("End row");
    const wide = shellFrom("Wide row");
    const startControl = checkboxNamed("Start row").getBoundingClientRect();
    const startTitle = headingNamed("Start row").getBoundingClientRect();
    expect(startControl.left).toBeLessThan(startTitle.left);

    const endControl = checkboxNamed("End row").getBoundingClientRect();
    const endTitle = headingNamed("End row").getBoundingClientRect();
    expect(endControl.left).toBeGreaterThan(endTitle.left);

    expect(getComputedStyle(start).display).toBe("grid");
    expect(getComputedStyle(end).display).toBe("grid");
    expect(getComputedStyle(wide).display).toBe("grid");

    const startSpacer = subsectionSpacer("Start extra");
    const endSpacer = subsectionSpacer("End extra");
    const wideSpacer = subsectionSpacer("Wide extra");
    expect(startSpacer.getAttribute("style")).toBeNull();
    expect(endSpacer.getAttribute("style")).toBeNull();
    expect(wideSpacer.getAttribute("style")).toBeNull();
    expect(startSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(start).getBoundingClientRect().left,
      0
    );
    expect(endSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(end).getBoundingClientRect().left,
      0
    );
    expect(wideSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(wide).getBoundingClientRect().left,
      0
    );
    expect(startSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(start).getBoundingClientRect().width,
      0
    );
    expect(endSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(end).getBoundingClientRect().width,
      0
    );
    expect(wideSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(wide).getBoundingClientRect().width,
      0
    );
    expect(wideSpacer.getBoundingClientRect().width).toBeGreaterThan(
      startSpacer.getBoundingClientRect().width
    );

    const endExtra = roleNamed("region", "End extra").getBoundingClientRect();
    expect(endSpacer.getBoundingClientRect().left).toBeGreaterThan(endExtra.left);
    const startExtra = roleNamed("region", "Start extra").getBoundingClientRect();
    expect(startSpacer.getBoundingClientRect().left).toBeLessThan(startExtra.left);
  });

  it("does not toggle a disabled control on row click and hatches the surface", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" isDisabled control={<Checkbox.Root disabled />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const box = checkboxNamed("Fixed price");
    expect(box.getAttribute("aria-checked")).toBe("false");
    const shell = shellFrom("Fixed price");
    const shellStyle = getComputedStyle(shell);
    expect(shellStyle.cursor).toBe("not-allowed");
    expect(shellStyle.backgroundColor).toBe(tokenBackgroundColor(shell, "bg-muted"));
    expect(shellStyle.backgroundImage).toBe(tokenBackgroundImage(shell, disabledHatch));
    expect(shellStyle.backgroundImage).not.toBe("none");

    headingNamed("Fixed price").click();
    expect(checkboxNamed("Fixed price", false).getAttribute("aria-checked")).toBe("false");
  });

  it("reflects the checked descendant on the shell surface", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root defaultChecked />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const box = checkboxNamed("Fixed price", true);
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(box.hasAttribute("data-checked")).toBe(true);
    const shell = shellFrom("Fixed price");
    expect(getComputedStyle(shell).borderTopColor).toBe(tokenBorderColor(shell, "border-primary"));
    expect(getComputedStyle(shell).backgroundColor).toBe(tokenBackgroundColor(shell, "bg-muted"));
  });

  it("collapses stacked borders and pulls a checked non-first shell up one pixel", () => {
    renderThemed(
      <Field.Root className="gap-0">
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>First</RowTitle>
        </SelectionItem.Shell>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root defaultChecked />}>
          <RowTitle>Second</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const first = shellFrom("First");
    const second = shellFrom("Second");
    expect(getComputedStyle(second).marginTop).toBe("-1px");
    expect(getComputedStyle(second).borderTopColor).toBe(tokenBorderColor(second, "border-primary"));
    expect(getComputedStyle(first).marginTop).not.toBe("-1px");
  });

  it("does not paint checked shell state from a nested checked control in SubSection", async () => {
    renderThemed(
      <Field.Root className="gap-0">
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>First</RowTitle>
        </SelectionItem.Shell>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Shell row</RowTitle>
          <SelectionItem.SubSection>
            <Field.Root>
              <Field.Label>Nested extra</Field.Label>
              <UiCheckbox defaultChecked />
            </Field.Root>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const first = shellFrom("First");
    const shell = shellFrom("Shell row");
    expect(checkboxNamed("Shell row", false).getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Nested extra", true).getAttribute("aria-checked")).toBe("true");
    expect(getComputedStyle(shell).marginTop).toBe(getComputedStyle(first).marginTop);
    expect(getComputedStyle(shell).borderTopWidth).toBe("0px");
    expect(getComputedStyle(shell).marginTop).not.toBe("-1px");

    await userEvent.click(headingNamed("Shell row"));
    expect(checkboxNamed("Shell row", true).getAttribute("aria-checked")).toBe("true");
    expect(getComputedStyle(shell).backgroundColor).toBe(tokenBackgroundColor(shell, "bg-muted"));
    expect(getComputedStyle(shell).borderTopColor).toBe(tokenBorderColor(shell, "border-primary"));
    expect(getComputedStyle(shell).borderTopWidth).not.toBe("0px");
    expect(getComputedStyle(shell).marginTop).toBe("-1px");
  });

  it("toggles from the keyboard on the plugged-in control", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Field.Root>
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Fixed price</RowTitle>
          </SelectionItem.Shell>
        </Field.Root>
      </>
    );

    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(before instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    before.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(checkboxNamed("Fixed price"));
    await userEvent.keyboard(" ");
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });
});

/**
 * The one orientation map. These assertions compare the two families against each other rather than against
 * a class string, so the map cannot be forked back into two copies without one of the two
 * moving and this failing. The fieldset skeleton is FieldFrame `heading="legend"`.
 */
describe("selection group orientation map", () => {
  function radioNamed(name: string): HTMLElement {
    const element = page.getByRole("radio", { name, exact: true }).element();
    if (!(element instanceof HTMLElement)) {
      throw new Error(`expected radio named ${name}`);
    }
    return element;
  }

  /** The group primitive a member sits in: the `Field.Set` child that contains it. */
  function groupPrimitiveAround(member: HTMLElement): HTMLElement {
    const set = member.closest("fieldset");
    const primitive = [...(set?.children ?? [])].find((child) => child.contains(member));
    if (!(primitive instanceof HTMLElement)) {
      throw new Error("expected a group primitive under the fieldset");
    }
    return primitive;
  }

  function itemListAround(member: HTMLElement): HTMLElement {
    const list = member.closest("[role=list]");
    if (!(list instanceof HTMLElement)) {
      throw new Error("expected the private item list");
    }
    return list;
  }

  /** The four computed properties the two orientation arms actually set. */
  type GroupLayout = { display: string; flexDirection: string; flexWrap: string; gap: string };

  function layout(element: HTMLElement): GroupLayout {
    const style = getComputedStyle(element);
    return {
      display: style.display,
      flexDirection: style.flexDirection,
      flexWrap: style.flexWrap,
      gap: style.rowGap,
    };
  }

  const VERTICAL_GROUP = {
    display: "flex",
    flexDirection: "column",
    flexWrap: "nowrap",
    gap: "8px",
  } satisfies GroupLayout;
  const HORIZONTAL = {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "16px",
  } satisfies GroupLayout;
  const VERTICAL_LIST = {
    display: "flex",
    flexDirection: "column",
    flexWrap: "nowrap",
    gap: "0px",
  } satisfies GroupLayout;

  it("lays a checkbox group and a radio group out identically at each orientation", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Checks vertical">
          <Field.Label>
            <UiCheckbox value="a" />
            Check vertical
          </Field.Label>
        </CheckboxGroup>
        <RadioGroup label="Radios vertical">
          <Radio value="a">Radio vertical</Radio>
        </RadioGroup>
        <CheckboxGroup label="Checks horizontal" orientation="horizontal">
          <Field.Label>
            <UiCheckbox value="a" />
            Check horizontal
          </Field.Label>
        </CheckboxGroup>
        <RadioGroup label="Radios horizontal" orientation="horizontal">
          <Radio value="a">Radio horizontal</Radio>
        </RadioGroup>
      </>
    );

    const checksVertical = layout(groupPrimitiveAround(checkboxNamed("Check vertical")));
    const checksHorizontal = layout(groupPrimitiveAround(checkboxNamed("Check horizontal")));
    expect(checksVertical).toEqual(layout(groupPrimitiveAround(radioNamed("Radio vertical"))));
    expect(checksHorizontal).toEqual(layout(groupPrimitiveAround(radioNamed("Radio horizontal"))));
    // Signed values, so an unstyled pair cannot pass by matching each other's defaults.
    expect(checksVertical).toEqual(VERTICAL_GROUP);
    expect(checksHorizontal).toEqual(HORIZONTAL);
  });

  it("lays a checkbox card list and a radio card list out identically at each orientation", () => {
    renderThemed(
      <>
        <CheckboxItemGroup label="Check cards vertical">
          <CheckboxItem value="a">
            <RowTitle>Check card vertical</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioItemGroup label="Radio cards vertical">
          <RadioItem value="a">
            <RowTitle>Radio card vertical</RowTitle>
          </RadioItem>
        </RadioItemGroup>
        <CheckboxItemGroup label="Check cards horizontal" orientation="horizontal">
          <CheckboxItem value="a">
            <RowTitle>Check card horizontal</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioItemGroup label="Radio cards horizontal" orientation="horizontal">
          <RadioItem value="a">
            <RowTitle>Radio card horizontal</RowTitle>
          </RadioItem>
        </RadioItemGroup>
      </>
    );

    const checkVertical = layout(itemListAround(checkboxNamed("Check card vertical")));
    const checkHorizontal = layout(itemListAround(checkboxNamed("Check card horizontal")));
    expect(checkVertical).toEqual(layout(itemListAround(radioNamed("Radio card vertical"))));
    expect(checkHorizontal).toEqual(layout(itemListAround(radioNamed("Radio card horizontal"))));
    expect(checkVertical).toEqual(VERTICAL_LIST);
    expect(checkHorizontal).toEqual(HORIZONTAL);
    // The card list is nested in a group primitive that keeps the group orientation.
    expect(layout(groupPrimitiveAround(checkboxNamed("Check card vertical")))).toEqual(VERTICAL_GROUP);
    expect(layout(groupPrimitiveAround(radioNamed("Radio card horizontal")))).toEqual(HORIZONTAL);
  });

  it("collapses the plain vertical group gap when its direct children are shells", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Check shells vertical">
          <CheckboxItem value="a">Check shell vertical a</CheckboxItem>
          <CheckboxItem value="b">Check shell vertical b</CheckboxItem>
        </CheckboxGroup>
        <RadioGroup label="Radio shells vertical">
          <RadioItem value="a">
            <RowTitle>Radio shell vertical a</RowTitle>
          </RadioItem>
          <RadioItem value="b">
            <RowTitle>Radio shell vertical b</RowTitle>
          </RadioItem>
        </RadioGroup>
      </>
    );

    const checkGroup = groupPrimitiveAround(checkboxNamed("Check shell vertical a"));
    const radioGroup = groupPrimitiveAround(radioNamed("Radio shell vertical a"));
    expect(layout(checkGroup)).toEqual(VERTICAL_LIST);
    expect(layout(radioGroup)).toEqual(VERTICAL_LIST);
    // Plain groups stay plain: no list semantics are added to the shells.
    expect(page.getByRole("listitem").elements()).toHaveLength(0);
    // The second shell still collapses its top border into the first, as a connected stack.
    const secondCheck = checkboxNamed("Check shell vertical b").closest("[data-selection-item]");
    if (!(secondCheck instanceof HTMLElement)) {
      throw new Error("expected checkbox-item shell");
    }
    expect(getComputedStyle(secondCheck).borderTopWidth).toBe("0px");
  });

  it("renders shells in a plain horizontal group as independent rounded cards", () => {
    renderThemed(
      <div style={radiusToken}>
        <CheckboxGroup label="Check shells horizontal" orientation="horizontal">
          <CheckboxItem value="a">Check shell horizontal a</CheckboxItem>
          <CheckboxItem value="b">Check shell horizontal b</CheckboxItem>
        </CheckboxGroup>
        <RadioGroup label="Radio shells horizontal" orientation="horizontal">
          <RadioItem value="a">
            <RowTitle>Radio shell horizontal a</RowTitle>
          </RadioItem>
          <RadioItem value="b">
            <RowTitle>Radio shell horizontal b</RowTitle>
          </RadioItem>
        </RadioGroup>
      </div>
    );

    const checkGroup = groupPrimitiveAround(checkboxNamed("Check shell horizontal a"));
    const radioGroup = groupPrimitiveAround(radioNamed("Radio shell horizontal a"));
    assertHorizontalItemList(
      checkGroup,
      [...checkGroup.querySelectorAll("[data-selection-item]")].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )
    );
    assertHorizontalItemList(
      radioGroup,
      [...radioGroup.querySelectorAll("[data-selection-item]")].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )
    );
    expect(page.getByRole("listitem").elements()).toHaveLength(0);
  });

  it("gives every member control an accessible name in both the plain and card shapes", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Plain checks" description="Pick some" errorMessage="Check error">
          <CheckboxItem value="a">Plain check</CheckboxItem>
        </CheckboxGroup>
        <CheckboxItemGroup label="Card checks" description="Pick some" errorMessage="Card check error">
          <CheckboxItem value="a">
            <RowTitle>Card check</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioGroup label="Plain radios" description="Pick one" errorMessage="Radio error">
          <Radio value="a">Plain radio</Radio>
        </RadioGroup>
        <RadioItemGroup label="Card radios" description="Pick one" errorMessage="Card radio error">
          <RadioItem value="a">
            <RowTitle>Card radio</RowTitle>
          </RadioItem>
        </RadioItemGroup>
      </>
    );

    // Every control is named, including inside cards: a nested Field.Root
    // would leave these blank.
    for (const name of ["Plain check", "Card check"]) {
      expect(checkboxNamed(name)).toBeTruthy();
    }
    for (const name of ["Plain radio", "Card radio"]) {
      expect(radioNamed(name)).toBeTruthy();
    }
    // The groups keep their legend name, and each frame renders exactly one alert.
    for (const name of ["Plain checks", "Card checks"]) {
      expect(page.getByRole("group", { name, exact: true }).elements().length).toBeGreaterThan(0);
    }
    for (const name of ["Plain radios", "Card radios"]) {
      expect(page.getByRole("radiogroup", { name, exact: true }).element()).toBeTruthy();
    }
    expect(
      page
        .getByRole("alert")
        .elements()
        .map((element) => element.textContent)
    ).toEqual(["Check error", "Card check error", "Radio error", "Card radio error"]);
  });
});
