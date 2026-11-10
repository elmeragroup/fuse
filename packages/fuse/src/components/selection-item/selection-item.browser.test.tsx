import { Checkbox } from "@base-ui/react/checkbox";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the fill test reads --card and --background.
import "../../../dist/themes.css";
import { checkboxNamed, RowTitle, settled, shellFrom } from "../../../test/selection-row";
import {
  cssVarColor,
  fkasBranded,
  headingNamed,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { Field } from "../field";
import { Item } from "../item";
import { RadioItemGroup } from "../radio-group/radio-group";
import { RadioItem } from "../radio-group/radio-item";
import { SelectionItem } from "./index";

function tokenBackgroundColor(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

describe("SelectionItem", () => {
  describe("isSubSectionSelectable", () => {
    function SelectablePlan({ isSubSectionSelectable }: { isSubSectionSelectable?: boolean }) {
      return (
        <CheckboxItemGroup label="Plans">
          <CheckboxItem value="fixed" isSubSectionSelectable={isSubSectionSelectable}>
            <RowTitle>Fixed price</RowTitle>
            <CheckboxItem.SubSection role="region" aria-label="Price details">
              <p>Locked for twelve months.</p>
              <a href="#price-terms">Price terms</a>
            </CheckboxItem.SubSection>
          </CheckboxItem>
        </CheckboxItemGroup>
      );
    }

    it("leaves the SubSection's text outside the click target by default", async () => {
      renderThemed(<SelectablePlan />);

      await userEvent.click(textNamed("Locked for twelve months."));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("false");
    });

    it("does not toggle on a click that ends a text selection", () => {
      renderThemed(<SelectablePlan isSubSectionSelectable />);

      const text = textNamed("Locked for twelve months.");
      const selection = window.getSelection();
      selection?.selectAllChildren(text);
      expect(selection?.isCollapsed).toBe(false);
      // A drag that selects text ends in a click on the text, with the selection still made.
      text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("false");

      selection?.removeAllRanges();
      text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("true");
    });

    it("toggles while text outside the row stays selected", async () => {
      renderThemed(
        <>
          <p>Compare the plans below.</p>
          <SelectablePlan isSubSectionSelectable />
        </>
      );

      const selection = window.getSelection();
      selection?.selectAllChildren(textNamed("Compare the plans below."));
      await userEvent.click(textNamed("Locked for twelve months."));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("true");
      selection?.removeAllRanges();
    });

    it("selects and focuses a RadioItem from its SubSection's text, so the arrow keys carry on", async () => {
      renderThemed(
        <RadioItemGroup label="Plans">
          <RadioItem value="fixed" isSubSectionSelectable>
            <RowTitle>Fixed price</RowTitle>
            <RadioItem.SubSection>Locked for twelve months.</RadioItem.SubSection>
          </RadioItem>
          <RadioItem value="spot" isSubSectionSelectable>
            <RowTitle>Spot price</RowTitle>
            <RadioItem.SubSection>Follows the market.</RadioItem.SubSection>
          </RadioItem>
        </RadioItemGroup>
      );

      await userEvent.click(textNamed("Locked for twelve months."));
      const fixed = roleNamed("radio", "Fixed price");
      expect(fixed.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(fixed);
      await userEvent.keyboard("{ArrowDown}");
      expect(roleNamed("radio", "Spot price").getAttribute("aria-checked")).toBe("true");
    });

    it("focuses a CheckboxItem's control from its SubSection's text, so Space toggles it back", async () => {
      renderThemed(<SelectablePlan isSubSectionSelectable />);

      await userEvent.click(textNamed("Locked for twelve months."));
      const checkbox = checkboxNamed("Fixed price");
      expect(checkbox.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(checkbox);
      await userEvent.keyboard(" ");
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
    });

    it("shows the label row's cursor over the SubSection, and not-allowed while disabled", () => {
      renderThemed(
        <CheckboxItemGroup label="Plans">
          <CheckboxItem value="fixed" isSubSectionSelectable>
            <RowTitle>Fixed price</RowTitle>
            <CheckboxItem.SubSection>Locked for twelve months.</CheckboxItem.SubSection>
          </CheckboxItem>
          <CheckboxItem value="variable" isSubSectionSelectable isDisabled>
            <RowTitle>Variable price</RowTitle>
            <CheckboxItem.SubSection>Follows the market.</CheckboxItem.SubSection>
          </CheckboxItem>
        </CheckboxItemGroup>
      );

      expect(getComputedStyle(textNamed("Locked for twelve months.")).cursor).toBe(
        getComputedStyle(headingNamed("Fixed price")).cursor
      );
      expect(getComputedStyle(headingNamed("Fixed price")).cursor).toBe("pointer");
      expect(getComputedStyle(textNamed("Follows the market.")).cursor).toBe("not-allowed");
    });
  });

  it("does not toggle a disabled control on row click and shows the not-allowed cursor", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" isDisabled control={<Checkbox.Root disabled />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const box = checkboxNamed("Fixed price");
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(getComputedStyle(shellFrom("Fixed price")).cursor).toBe("not-allowed");

    headingNamed("Fixed price").click();
    expect(checkboxNamed("Fixed price", false).getAttribute("aria-checked")).toBe("false");
  });

  it("does not paint checked shell state from a checked selection row nested in SubSection", async () => {
    /** Three unchecked rows; the middle one's SubSection holds a checked selection row. */
    const Rows = ({ prefix }: { prefix: string }) => (
      <CheckboxItemGroup label={`${prefix}Plans`}>
        <CheckboxItem value="basic">
          <RowTitle>{`${prefix}Basic`}</RowTitle>
        </CheckboxItem>
        <CheckboxItem value="bundle">
          <RowTitle>{`${prefix}Bundle`}</RowTitle>
          <CheckboxItem.SubSection>
            <CheckboxItemGroup label={`${prefix}Bundle extras`} defaultValue={["router"]}>
              <CheckboxItem value="router">
                <RowTitle>{`${prefix}Router`}</RowTitle>
              </CheckboxItem>
            </CheckboxItemGroup>
          </CheckboxItem.SubSection>
        </CheckboxItem>
        <CheckboxItem value="support">
          <RowTitle>{`${prefix}Support`}</RowTitle>
        </CheckboxItem>
      </CheckboxItemGroup>
    );
    renderThemed(
      <>
        <Rows prefix="" />
        <ThemeScope theme={fkasBranded}>
          <Rows prefix="Branded " />
        </ThemeScope>
      </>
    );

    const shell = shellFrom("Bundle");
    await settled(shell);
    expect(checkboxNamed("Bundle").getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Router").getAttribute("aria-checked")).toBe("true");
    // Oracle sanity: a checked repaint would change each colour asserted below.
    expect(cssVarColor(shell, "--primary")).not.toBe(cssVarColor(shell, "--border"));
    expect(tokenBackgroundColor(shell, "bg-muted")).not.toBe(cssVarColor(shell, "--card"));
    const style = getComputedStyle(shell);
    expect(style.backgroundColor).toBe(cssVarColor(shell, "--card"));
    expect(style.borderBottomColor).toBe(cssVarColor(shell, "--border"));
    expect(style.marginTop).toBe("0px");
    expect(style.borderTopWidth).toBe("0px");

    const branded = shellFrom("Branded Bundle");
    await settled(branded);
    expect(checkboxNamed("Branded Bundle").getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Branded Router").getAttribute("aria-checked")).toBe("true");
    expect(tokenBackgroundColor(branded, "bg-muted")).not.toBe(cssVarColor(branded, "--card"));
    expect(getComputedStyle(branded).backgroundColor).toBe(cssVarColor(branded, "--card"));
    expect(getComputedStyle(branded).marginTop).toBe("0px");
  });
});

function fontAndLeading(element: HTMLElement): [number, number] {
  const style = getComputedStyle(element);
  return [Number.parseFloat(style.fontSize), Number.parseFloat(style.lineHeight)];
}

describe("selection row type", () => {
  // Alert's title and description follow density through the label text; alert.browser.test.tsx
  // covers them.
  it("leaves Item titles and descriptions at text-sm when comfortable", () => {
    stampDensity("comfortable");
    renderThemed(
      <Item.Root>
        <Item.Content>
          <Item.Title>Item title</Item.Title>
          <Item.Description>Item description</Item.Description>
        </Item.Content>
      </Item.Root>
    );

    for (const text of ["Item title", "Item description"]) {
      expect(fontAndLeading(textNamed(text))[0], text).toBe(14);
    }
  });
});
