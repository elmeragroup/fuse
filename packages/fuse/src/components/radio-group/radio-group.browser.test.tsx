import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  assertLegendVisuallyHidden,
  bodyOffset,
  legendFieldset,
} from "../../../test/assert-group-label-hidden";
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
  formNamed,
  headingNamed,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { Badge } from "../badge/badge";
import { Field } from "../field";
import { Radio, RadioGroup, RadioGroupItem, RadioIconButton, RadioItemGroup } from "./radio-group";
import { RadioItem } from "./radio-item";

const ICON_SIZES = ["icon-xxs", "icon-xs", "icon-sm", "icon", "icon-lg"] as const;

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

  it.each([
    {
      control: "Radio",
      name: "Fixed",
      group: (
        <RadioGroup label="Contract">
          <Radio value="fixed">Fixed</Radio>
        </RadioGroup>
      ),
    },
    {
      control: "RadioIconButton",
      name: "List",
      group: (
        <RadioGroup label="View">
          <RadioIconButton value="list" aria-label="List">
            <Glyph />
          </RadioIconButton>
        </RadioGroup>
      ),
    },
  ])(
    "paints the shared ring on a $control on keyboard focus-visible and not on mouse focus, at both densities",
    async ({ name, group }) => {
      renderThemed(
        <>
          <button type="button">Before</button>
          {group}
        </>
      );
      await assertFocusRingAtBothDensities(roleNamed("button", "Before"), radioNamed(name));
    }
  );
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
  // Vertical: stacked RadioItems stay direct-sibling listitems in one connected list.
  // Horizontal: a wrapping-gap item list of independent card shells.
  it.each([
    {
      layout: "stacked (default vertical)",
      orientation: undefined,
      label: "Plans",
      assertLayout: (list: HTMLElement, first: HTMLElement, second: HTMLElement) => {
        assertConnectedVerticalList(list, first, second);
      },
    },
    {
      layout: "horizontal",
      orientation: "horizontal",
      label: "Horizontal plans",
      assertLayout: (list: HTMLElement, first: HTMLElement, second: HTMLElement) => {
        assertHorizontalItemList(list, [first, second]);
      },
    },
  ] as const)(
    "exposes $layout RadioItems as direct-sibling listitems with that layout",
    ({ orientation, label, assertLayout }) => {
      renderThemed(
        <div style={radiusToken}>
          <RadioItemGroup label={label} orientation={orientation} defaultValue="hourly">
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

      expect(radiogroupNamed(label)).toBeTruthy();
      const [first, second] = listitemHosts();
      const list = assertDirectSiblingList(first, second);
      expect(first.contains(radioNamed("Fixed price", false))).toBe(true);
      expect(second.contains(radioNamed("Hourly", true))).toBe(true);
      assertLayout(list, first, second);
    }
  );
});

describe("isLabelHidden", () => {
  it.each([
    { part: "RadioGroup", Group: RadioGroup },
    { part: "RadioItemGroup", Group: RadioItemGroup },
  ])("keeps a pending $part's spinner visible while its legend is hidden", ({ Group }) => {
    renderThemed(
      <Group label="Pending contract" isLabelHidden isPending>
        <RadioItem value="fixed">Pending fixed</RadioItem>
      </Group>
    );

    const group = radiogroupNamed("Pending contract");
    const fieldset = legendFieldset("Pending contract");
    assertLegendVisuallyHidden(fieldset);
    const spinner = fieldset.querySelector("svg");
    if (spinner === null || group.contains(spinner)) {
      throw new Error("expected the pending spinner above the radiogroup");
    }
    expect(spinner.getBoundingClientRect().width).toBeGreaterThan(1);
    expect(bodyOffset(fieldset, group)).toBeGreaterThan(0);
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

  // control-size.browser.test.tsx measures each size's square against DENSITY_METRICS; the
  // glyph size is RadioIconButton's own.
  it("renders every size's glyph with an accessible name", () => {
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
        const svg = button.querySelector("svg");
        if (!(svg instanceof SVGElement)) {
          throw new Error(`expected an svg in ${size}`);
        }
        expect(Number.parseFloat(getComputedStyle(svg).width)).toBe(ICON_SVG_PX[size]);
        expect(Number.parseFloat(getComputedStyle(svg).height)).toBe(ICON_SVG_PX[size]);
      }
    }
  });
});

describe("RadioGroupItem", () => {
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
