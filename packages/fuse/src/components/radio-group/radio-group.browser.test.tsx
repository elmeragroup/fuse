import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  assertConnectedVerticalList,
  assertDirectSiblingList,
  assertHorizontalItemList,
  listitemHosts,
  radiusToken,
} from "../../../test/assert-selection-item-group-layout";
import {
  cssVarColor,
  effectiveOpacity,
  headingNamed,
  px,
  renderThemed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { Badge } from "../badge/badge";
import { Radio, RadioGroup, RadioGroupItem, RadioIconButton, RadioItem, RadioItemGroup } from "./radio-group";

const ICON_SIZES = ["icon-xxs", "icon-xs", "icon-sm", "icon", "icon-lg"] as const;

const ICON_TO_RUNG = {
  "icon-xxs": "xs",
  "icon-xs": "xs",
  "icon-sm": "sm",
  icon: "md",
  "icon-lg": "lg",
} as const satisfies Record<(typeof ICON_SIZES)[number], "xs" | "sm" | "md" | "lg">;

const ICON_BOX = {
  dense: { xs: 24, sm: 32, md: 36, lg: 40 },
  comfortable: { xs: 32, sm: 36, md: 44, lg: 48 },
} as const;

const ICON_SVG_PX = {
  "icon-xxs": 12,
  "icon-xs": 14,
  "icon-sm": 16,
  icon: 16,
  "icon-lg": 20,
} as const satisfies Record<(typeof ICON_SIZES)[number], number>;

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

function flexAncestor(
  element: HTMLElement,
  match: (style: CSSStyleDeclaration) => boolean
): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const style = getComputedStyle(current);
    if ((style.display === "flex" || style.display === "inline-flex") && match(style)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function Glyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" />
    </svg>
  );
}

describe("RadioGroup", () => {
  it("exposes members through the legend name and calls onChange with a string", async () => {
    const onChange = vi.fn();
    renderThemed(
      <RadioGroup label="Contract" description="Choose a plan." onChange={onChange}>
        <Radio value="fixed">Fixed</Radio>
        <Radio value="spot">Spot</Radio>
      </RadioGroup>
    );

    expect(radiogroupNamed("Contract")).toBeTruthy();
    expect(radioNamed("Fixed", false).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(page.getByRole("radio", { name: "Fixed", exact: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toBe("fixed");
    expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
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

  it("sets aria-busy on the named radiogroup while pending and omits it otherwise", () => {
    renderThemed(
      <>
        <RadioGroup label="Idle">
          <Radio value="a">Idle option</Radio>
        </RadioGroup>
        <RadioGroup label="Idle false" isPending={false}>
          <Radio value="a">Idle false option</Radio>
        </RadioGroup>
        <RadioGroup label="Busy" isPending>
          <Radio value="a">Busy option</Radio>
        </RadioGroup>
      </>
    );

    expect(radiogroupNamed("Idle").hasAttribute("aria-busy")).toBe(false);
    expect(radiogroupNamed("Idle false").hasAttribute("aria-busy")).toBe(false);
    expect(radiogroupNamed("Busy").getAttribute("aria-busy")).toBe("true");
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

  it("switches orientation via computed layout, not class names", () => {
    renderThemed(
      <>
        <RadioGroup label="Vertical contract" orientation="vertical">
          <Radio value="a">Fixed</Radio>
          <Radio value="b">Spot</Radio>
        </RadioGroup>
        <RadioGroup label="Horizontal contract" orientation="horizontal">
          <Radio value="a">Monthly</Radio>
          <Radio value="b">Quarterly</Radio>
        </RadioGroup>
      </>
    );

    const verticalFirst = radioNamed("Fixed").getBoundingClientRect();
    const verticalSecond = radioNamed("Spot").getBoundingClientRect();
    expect(verticalSecond.top).toBeGreaterThan(verticalFirst.bottom);
    expect(flexAncestor(radioNamed("Fixed"), (style) => style.flexDirection === "column")).not.toBeNull();
    expect(
      flexAncestor(
        radioNamed("Monthly"),
        (style) => style.flexDirection === "row" && style.flexWrap === "wrap"
      )
    ).not.toBeNull();
  });
});

describe("Radio", () => {
  it("selects from a label click and skips a disabled row with arrows", async () => {
    renderThemed(
      <RadioGroup label="Contract" defaultValue="fixed">
        <Radio value="fixed">Fixed</Radio>
        <Radio value="spot" isDisabled>
          Spot
        </Radio>
        <Radio value="hourly">Hourly</Radio>
      </RadioGroup>
    );

    const hourlyLabel = radioNamed("Hourly", false).closest("label");
    if (!(hourlyLabel instanceof HTMLElement)) {
      throw new Error("expected Hourly to be wrapped in a label");
    }
    await userEvent.click(hourlyLabel);
    expect(radioNamed("Hourly", true).getAttribute("aria-checked")).toBe("true");

    radioNamed("Hourly", true).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(radioNamed("Fixed", true).getAttribute("aria-checked")).toBe("true");
    expect(
      radioNamed("Spot").getAttribute("aria-disabled") === "true" ||
        radioNamed("Spot").hasAttribute("disabled")
    ).toBe(true);
  });

  it("dims a disabled row's control and label text once each", () => {
    renderThemed(
      <RadioGroup label="Contract">
        <Radio value="spot" isDisabled>
          Spot
        </Radio>
        <Radio value="fixed">Fixed</Radio>
      </RadioGroup>
    );

    // The control dims itself and the label dims only its text, so neither compounds.
    expect(effectiveOpacity(radioNamed("Spot"))).toBe(0.5);
    expect(effectiveOpacity(textNamed("Spot"))).toBe(0.5);
    expect(effectiveOpacity(radioNamed("Fixed"))).toBe(1);
    expect(effectiveOpacity(textNamed("Fixed"))).toBe(1);
  });

  it("lays out rich label content in the label's row and dims all of it once", () => {
    renderThemed(
      <RadioGroup label="Contract">
        <Radio value="spot" isDisabled>
          Spot <Badge>New</Badge>
        </Radio>
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
    expect(effectiveOpacity(radioNamed("Spot New"))).toBe(0.5);
    expect(effectiveOpacity(badge)).toBe(0.5);
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <RadioGroup label="Contract">
          <Radio value="fixed">Fixed</Radio>
        </RadioGroup>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingAtBothDensities(previous, radioNamed("Fixed"));
  });
});

describe("RadioItem", () => {
  it("selects from the row and isolates SubSection clicks", async () => {
    renderThemed(
      <RadioGroup label="Plans">
        <RadioItem value="fixed">
          <RadioItem.Title role="heading" aria-level={3}>
            Fixed price
          </RadioItem.Title>
          <RadioItem.SubSection>
            <button type="button">Details</button>
          </RadioItem.SubSection>
        </RadioItem>
      </RadioGroup>
    );

    const details = page.getByRole("button", { name: "Details", exact: true }).element();
    expect(details.closest("label")).toBeNull();
    expect(page.getByRole("listitem").elements()).toHaveLength(0);
    await userEvent.click(headingNamed("Fixed price"));
    expect(radioNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(page.getByRole("button", { name: "Details", exact: true }));
    expect(radioNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });

  it("does not select a disabled row", async () => {
    renderThemed(
      <RadioGroup label="Plans">
        <RadioItem value="fixed" isDisabled>
          <RadioItem.Title role="heading" aria-level={3}>
            Fixed price
          </RadioItem.Title>
        </RadioItem>
      </RadioGroup>
    );

    headingNamed("Fixed price").click();
    expect(radioNamed("Fixed price", false).getAttribute("aria-checked")).toBe("false");
    await expect.element(page.getByRole("radio", { name: "Fixed price", exact: true })).toBeDisabled();
  });

  it("renders a trailing control when controlPosition is end", () => {
    renderThemed(
      <RadioGroup label="Plans">
        <RadioItem value="start">
          <RadioItem.Title role="heading" aria-level={3}>
            Start row
          </RadioItem.Title>
        </RadioItem>
        <RadioItem value="end" controlPosition="end">
          <RadioItem.Title role="heading" aria-level={3}>
            End row
          </RadioItem.Title>
        </RadioItem>
      </RadioGroup>
    );

    const startTitle = headingNamed("Start row").getBoundingClientRect();
    const startControl = radioNamed("Start row").getBoundingClientRect();
    expect(startControl.left).toBeLessThan(startTitle.left);

    const endTitle = headingNamed("End row").getBoundingClientRect();
    const endControl = radioNamed("End row").getBoundingClientRect();
    expect(endControl.left).toBeGreaterThan(endTitle.right);
  });
});

describe("RadioItemGroup", () => {
  it("exposes stacked RadioItems as listitems that stay direct siblings", () => {
    renderThemed(
      <div style={radiusToken}>
        <RadioItemGroup label="Plans" defaultValue="hourly">
          <RadioItem value="fixed">
            <RadioItem.Title role="heading" aria-level={3}>
              Fixed price
            </RadioItem.Title>
          </RadioItem>
          <RadioItem value="hourly">
            <RadioItem.Title role="heading" aria-level={3}>
              Hourly
            </RadioItem.Title>
          </RadioItem>
        </RadioItemGroup>
      </div>
    );

    const [first, second] = listitemHosts();
    const list = assertDirectSiblingList(first, second);
    expect(first.contains(radioNamed("Fixed price", false))).toBe(true);
    expect(second.contains(radioNamed("Hourly", true))).toBe(true);
    assertConnectedVerticalList(list, first, second);
  });

  it("lays out a horizontal item list with wrapping gap and independent card shells", () => {
    renderThemed(
      <div style={radiusToken}>
        <RadioItemGroup label="Horizontal plans" orientation="horizontal" defaultValue="hourly">
          <RadioItem value="fixed">
            <RadioItem.Title role="heading" aria-level={3}>
              Fixed price
            </RadioItem.Title>
          </RadioItem>
          <RadioItem value="hourly">
            <RadioItem.Title role="heading" aria-level={3}>
              Hourly
            </RadioItem.Title>
          </RadioItem>
        </RadioItemGroup>
      </div>
    );

    expect(radiogroupNamed("Horizontal plans")).toBeTruthy();
    const [first, second] = listitemHosts();
    const list = assertDirectSiblingList(first, second);
    expect(first.contains(radioNamed("Fixed price", false))).toBe(true);
    expect(second.contains(radioNamed("Hourly", true))).toBe(true);
    assertHorizontalItemList(list, [first, second]);
  });
});

describe("RadioIconButton", () => {
  it("selects via click and keyboard within a group", async () => {
    const onChange = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <RadioGroup label="View" defaultValue="list" onChange={onChange}>
          <RadioIconButton value="list" aria-label="List">
            <Glyph />
          </RadioIconButton>
          <RadioIconButton value="house" aria-label="Home">
            <Glyph />
          </RadioIconButton>
        </RadioGroup>
      </>
    );

    expect(radioNamed("List", true).getAttribute("data-slot")).toBe("radio-icon-button");
    await userEvent.click(page.getByRole("radio", { name: "Home", exact: true }));
    expect(onChange).toHaveBeenCalledWith("house");
    expect(radioNamed("Home", true).getAttribute("aria-checked")).toBe("true");

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(radioNamed("Home", true));
    await userEvent.keyboard("{ArrowDown}");
    expect(radioNamed("List", true).getAttribute("aria-checked")).toBe("true");
  });

  it("renders every size's computed box and svg metrics with an accessible name", () => {
    renderThemed(
      <RadioGroup label="Sizes">
        {ICON_SIZES.map((size) => (
          <RadioIconButton key={size} value={size} size={size} aria-label={size}>
            <Glyph />
          </RadioIconButton>
        ))}
      </RadioGroup>
    );

    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      for (const size of ICON_SIZES) {
        const button = radioNamed(size);
        const box = ICON_BOX[density][ICON_TO_RUNG[size]];
        expect(px(getComputedStyle(button).width), `${density} ${size} width`).toBe(box);
        expect(px(getComputedStyle(button).height), `${density} ${size} height`).toBe(box);
        const svg = button.querySelector("svg");
        if (!(svg instanceof SVGElement)) {
          throw new Error(`expected an svg in ${size}`);
        }
        expect(Number.parseFloat(getComputedStyle(svg).width)).toBe(ICON_SVG_PX[size]);
        expect(Number.parseFloat(getComputedStyle(svg).height)).toBe(ICON_SVG_PX[size]);
      }
    }
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <RadioGroup label="View">
          <RadioIconButton value="list" aria-label="List">
            <Glyph />
          </RadioIconButton>
        </RadioGroup>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingAtBothDensities(previous, radioNamed("List"));
  });

  it("dims a disabled icon button to half opacity", () => {
    renderThemed(
      <RadioGroup label="View">
        <RadioIconButton value="list" aria-label="List" isDisabled>
          <Glyph />
        </RadioIconButton>
        <RadioIconButton value="grid" aria-label="Grid">
          <Glyph />
        </RadioIconButton>
      </RadioGroup>
    );

    expect(effectiveOpacity(radioNamed("List"))).toBe(0.5);
    expect(effectiveOpacity(radioNamed("Grid"))).toBe(1);
  });
});

describe("RadioGroupItem", () => {
  it("is named independently when given an accessible name", () => {
    renderThemed(
      <RadioGroup label="Contract">
        <RadioGroupItem value="fixed" aria-label="Fixed primitive" />
      </RadioGroup>
    );
    expect(radioNamed("Fixed primitive").getAttribute("data-slot")).toBe("radio-group-item");
  });

  it("dims a standalone disabled item to half opacity and leaves an enabled one opaque", () => {
    // Base UI renders the root as a <span>, which never matches `:disabled`. No label
    // wraps these items, so only the item's own rule can dim it.
    renderThemed(
      <RadioGroup label="Contract">
        <RadioGroupItem value="spot" aria-label="Spot primitive" disabled />
        <RadioGroupItem value="fixed" aria-label="Fixed primitive" />
      </RadioGroup>
    );

    expect(effectiveOpacity(radioNamed("Spot primitive"))).toBe(0.5);
    expect(effectiveOpacity(radioNamed("Fixed primitive"))).toBe(1);
  });

  it("composes library classes with a string className or a stateful callback", async () => {
    renderThemed(
      <RadioGroup label="Contract" defaultValue="fixed">
        <RadioGroupItem value="fixed" aria-label="Fixed primitive" className="radio-group-item-string" />
        <RadioGroupItem
          value="spot"
          aria-label="Spot primitive"
          className={(state) =>
            state.checked ? "radio-group-item-checked-callback" : "radio-group-item-unchecked-callback"
          }
        />
      </RadioGroup>
    );

    const fixed = radioNamed("Fixed primitive", true);
    expect(fixed.classList.contains("radio-group-item-string")).toBe(true);
    expect(fixed.classList.contains("group/radio-group-item")).toBe(true);

    const spot = radioNamed("Spot primitive", false);
    expect(spot.classList.contains("radio-group-item-unchecked-callback")).toBe(true);
    expect(spot.classList.contains("group/radio-group-item")).toBe(true);

    await userEvent.click(page.getByRole("radio", { name: "Spot primitive", exact: true }));
    expect(radioNamed("Spot primitive", true).classList.contains("radio-group-item-checked-callback")).toBe(
      true
    );
    expect(radioNamed("Spot primitive", true).classList.contains("radio-group-item-unchecked-callback")).toBe(
      false
    );
  });
});
