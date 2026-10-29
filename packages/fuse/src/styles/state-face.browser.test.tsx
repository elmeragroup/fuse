import type { ReactNode } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { expectFocusRing } from "../../test/assert-focus-ring";
import {
  expectInvalidFocusRing,
  expectInvalidRing,
  expectNoRing,
  ringLayers,
  settleTransitions,
} from "../../test/assert-invalid-ring";
import { withLocale } from "../../test/locale-matrix";
import { whilePointerPressed } from "../../test/pointer-press";
import {
  cssVarColor,
  effectiveOpacity,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../test/themed-browser-render";
import { Accordion } from "../components/accordion";
import { Button } from "../components/button/button";
import { CheckboxCard } from "../components/checkbox-card/checkbox-card";
import { Checkbox, CheckboxGroup } from "../components/checkbox/checkbox";
import { CheckboxItem } from "../components/checkbox/checkbox-item";
import { Combobox } from "../components/combobox";
import { InputGroup } from "../components/input-group";
import { Input } from "../components/input/input";
import { NumberField } from "../components/number-field/number-field";
import { Radio, RadioGroup, RadioIconButton } from "../components/radio-group/radio-group";
import { Select } from "../components/select";
import { Sidebar } from "../components/sidebar";
import { Switch } from "../components/switch/switch";
import { Tabs } from "../components/tabs";
import { TextField } from "../components/text-field/text-field";
import { ToggleGroup } from "../components/toggle-group";
import { Toggle } from "../components/toggle/toggle";
import { Tooltip } from "../components/tooltip";
import { ChartBar } from "../icons/generated/chart-bar";
import { DateField } from "../react-aria/date-field/date-field";
import { Link } from "../react-aria/link/link";
import { UiProviders } from "../react-aria/ui-providers/ui-providers";

/**
 * The state face of every whole interactive control: the disabled look, the invalid look,
 * and the gate that keeps hover and press from repainting a disabled control.
 *
 * Every expected value is written here by hand. A disabled control keeps the paint it has
 * at rest, shows the `not-allowed` cursor, and still opens a Tooltip. An invalid control
 * paints its border with the `--error` role and a 3px ring of that role at 20% alpha.
 */

/** What hover or press could change on a control. */
function pointerPaint(element: Element) {
  const style = getComputedStyle(element);
  return {
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    color: style.color,
    textDecorationLine: style.textDecorationLine,
    opacity: style.opacity,
    transform: style.transform,
    translate: style.translate,
    scale: style.scale,
  };
}

/** A CheckboxCard's checkbox, whose accessible name appends the card's description. */
function checkboxCardNamed(title: string): HTMLElement {
  const element = page.getByRole("checkbox", { name: title, exact: false }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox card named ${title}`);
  }
  return element;
}

/** The unnamed `role="group"` box around a control, such as NumberField's group. */
function groupAround(control: HTMLElement): HTMLElement {
  const group = control.closest<HTMLElement>('[role="group"]');
  if (group === null) {
    throw new Error("expected a group around the control");
  }
  return group;
}

async function moveAway(): Promise<void> {
  await userEvent.hover(page.getByText("Away", { exact: true }));
}

function renderStateFaces(node: ReactNode) {
  return renderThemed(
    withLocale(
      "en-US",
      <UiProviders locale="en-US" navigate={() => undefined}>
        <p>Away</p>
        {node}
      </UiProviders>
    )
  );
}

/** Every whole control, disabled. Pointer-driven faces get `transition-none` so reads are settled. */
function DisabledControls(): ReactNode {
  return (
    <>
      <Button disabled className="transition-none">
        Native button
      </Button>
      <Button variant="outline" disabled className="transition-none">
        Native outline button
      </Button>
      <Button variant="ghost" disabled focusableWhenDisabled className="transition-none">
        Focusable button
      </Button>
      <Button variant="outline" isVisuallyDisabled className="transition-none">
        Visually disabled button
      </Button>
      <Button variant="ghost" aria-disabled="true" className="transition-none">
        Aria-disabled button
      </Button>
      <Toggle disabled className="transition-none">
        Disabled toggle
      </Toggle>
      <Toggle variant="outline" disabled className="transition-none">
        Disabled outline toggle
      </Toggle>
      <ToggleGroup.Root aria-label="Alignment">
        <ToggleGroup.Item value="left" disabled className="transition-none">
          Disabled item
        </ToggleGroup.Item>
      </ToggleGroup.Root>
      <RadioGroup label="View">
        <RadioIconButton value="grid" aria-label="Disabled grid view" isDisabled className="transition-none">
          <ChartBar />
        </RadioIconButton>
        <Radio value="list" isDisabled>
          Disabled list view
        </Radio>
      </RadioGroup>
      <Checkbox aria-label="Disabled checkbox" disabled />
      <CheckboxGroup>
        <CheckboxCard value="roadside" title="Disabled card" description="Towing included." isDisabled />
      </CheckboxGroup>
      <Switch aria-label="Disabled switch" disabled />
      <Select.Root disabled>
        <Select.Trigger aria-label="Disabled select">
          <Select.Value placeholder="Pick one" />
        </Select.Trigger>
      </Select.Root>
      <Select.Root>
        <Select.Trigger aria-label="Aria-disabled select" aria-disabled="true">
          <Select.Value placeholder="Pick one" />
        </Select.Trigger>
      </Select.Root>
      <Tabs.Root defaultValue="account">
        <Tabs.List>
          <Tabs.Trigger value="account">Account</Tabs.Trigger>
          <Tabs.Trigger value="billing" disabled className="transition-none">
            Disabled tab
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton disabled className="transition-none">
            Disabled row
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton aria-disabled="true" className="transition-none">
            Aria-disabled row
          </Sidebar.MenuButton>
          <Sidebar.MenuSub>
            <Sidebar.MenuSubItem>
              <Sidebar.MenuSubButton href="#sub" aria-disabled="true" className="transition-none">
                Aria-disabled sub row
              </Sidebar.MenuSubButton>
            </Sidebar.MenuSubItem>
          </Sidebar.MenuSub>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
      <Input aria-label="Disabled input" disabled />
      <Input aria-label="Aria-disabled input" aria-disabled="true" />
      <TextField variant="inline" label="Disabled inline field" isDisabled className="transition-none" />
      <InputGroup.Root aria-label="Disabled group">
        <InputGroup.Input aria-label="Disabled group input" disabled />
      </InputGroup.Root>
      <Combobox.Root items={["Apple", "Banana"]} multiple defaultValue={["Apple"]} disabled>
        <Combobox.Chips aria-label="Disabled fruit">
          <Combobox.Chip>Apple</Combobox.Chip>
          <Combobox.ChipsInput aria-label="Disabled fruit input" />
        </Combobox.Chips>
      </Combobox.Root>
      <NumberField label="Disabled amount" isDisabled increaseLabel="Increase disabled amount" />
      <DateField label="Disabled date" isDisabled />
      <Accordion.Root>
        <Accordion.Item value="shipping" disabled>
          <Accordion.Header>
            <Accordion.Trigger className="transition-none">Disabled section</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Shipping details</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="returns">
          <Accordion.Header>
            <Accordion.Trigger aria-disabled="true" className="transition-none">
              Aria-disabled section
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Returns details</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
      <Link href="/orders" isDisabled className="transition-none">
        Disabled link
      </Link>
    </>
  );
}

const DISABLED_CONTROLS = [
  ["native button", () => roleNamed("button", "Native button")],
  ["native outline button", () => roleNamed("button", "Native outline button")],
  ["focusable disabled button", () => roleNamed("button", "Focusable button")],
  ["visually disabled button", () => roleNamed("button", "Visually disabled button")],
  ["aria-disabled button", () => roleNamed("button", "Aria-disabled button")],
  ["toggle", () => roleNamed("button", "Disabled toggle")],
  ["outline toggle", () => roleNamed("button", "Disabled outline toggle")],
  ["toggle group item", () => roleNamed("button", "Disabled item")],
  ["radio icon button", () => roleNamed("radio", "Disabled grid view")],
  ["radio", () => roleNamed("radio", "Disabled list view")],
  ["checkbox", () => roleNamed("checkbox", "Disabled checkbox")],
  ["checkbox card", () => checkboxCardNamed("Disabled card")],
  ["switch", () => roleNamed("switch", "Disabled switch")],
  ["select trigger", () => roleNamed("combobox", "Disabled select")],
  ["aria-disabled select trigger", () => roleNamed("combobox", "Aria-disabled select")],
  ["tab", () => roleNamed("tab", "Disabled tab")],
  ["sidebar menu button", () => roleNamed("button", "Disabled row")],
  ["aria-disabled sidebar menu button", () => roleNamed("button", "Aria-disabled row")],
  ["aria-disabled sidebar sub button", () => roleNamed("link", "Aria-disabled sub row")],
  ["input", () => roleNamed("textbox", "Disabled input")],
  ["aria-disabled input", () => roleNamed("textbox", "Aria-disabled input")],
  ["inline text field", () => roleNamed("textbox", "Disabled inline field")],
  ["input group", () => roleNamed("group", "Disabled group")],
  ["input group input", () => roleNamed("textbox", "Disabled group input")],
  ["combobox chips", () => roleNamed("toolbar", "Disabled fruit")],
  ["combobox chips input", () => roleNamed("combobox", "Disabled fruit input")],
  ["number field group", () => groupAround(roleNamed("textbox", "Disabled amount"))],
  ["number field input", () => roleNamed("textbox", "Disabled amount")],
  ["number field stepper", () => roleNamed("button", "Increase disabled amount")],
  ["date field", () => roleNamed("group", "Disabled date")],
  ["accordion trigger", () => roleNamed("button", "Disabled section")],
  ["aria-disabled accordion trigger", () => roleNamed("button", "Aria-disabled section")],
  ["link", () => roleNamed("link", "Disabled link")],
] as const;

// Density declares only --control-* metrics (density-css.test.ts), and nothing here reads one,
// so one density covers the paint, cursor, opacity and ring contracts.
describe("state face at dense density", () => {
  beforeEach(() => {
    stampDensity("dense");
  });

  it("keeps every disabled control's paint still under hover and press, dims it once and shows the not-allowed cursor", async () => {
    renderStateFaces(<DisabledControls />);
    // Every resting paint is read once with the pointer away, before any control is hovered,
    // so a group hovered earlier cannot leak a face into a nested control's resting read.
    await moveAway();
    const resting = DISABLED_CONTROLS.map(([, find]) => pointerPaint(find()));

    for (const [index, [label, find]] of DISABLED_CONTROLS.entries()) {
      const control = find();
      // A control inside a group (an input, a stepper) is dimmed by the group, so it paints
      // at the group's 0.5 rather than a doubled 0.25.
      expect.soft(effectiveOpacity(control), `${label} opacity`).toBe(0.5);

      // `force` skips Playwright's hit-target wait, so a control that drops pointer
      // events is still reached and its failure is the paint, not a timeout.
      await userEvent.hover(page.elementLocator(control), { force: true });
      expect.soft(pointerPaint(control), `${label} while hovered`).toEqual(resting[index]);
      expect.soft(getComputedStyle(control).cursor, `${label} cursor`).toBe("not-allowed");
      const pressed = await whilePointerPressed(() => pointerPaint(control));
      expect.soft(pressed, `${label} while pressed`).toEqual(resting[index]);
    }
  });

  it("dims an InputGroup once and shows the not-allowed cursor when its input is aria-disabled", async () => {
    // Not in the pointer-paint list: an `aria-disabled` input stays focusable, so a press
    // focuses it and the group paints its focus ring, which is focus, not a press face.
    renderStateFaces(
      <InputGroup.Root aria-label="Aria-disabled group">
        <InputGroup.Input aria-label="Aria-disabled group input" aria-disabled="true" />
      </InputGroup.Root>
    );

    for (const [label, control] of [
      ["aria-disabled input group", roleNamed("group", "Aria-disabled group")],
      ["aria-disabled input group input", roleNamed("textbox", "Aria-disabled group input")],
    ] as const) {
      await userEvent.hover(page.elementLocator(control));
      expect.soft(effectiveOpacity(control), label).toBe(0.5);
      expect.soft(getComputedStyle(control).cursor, label).toBe("not-allowed");
    }
  });

  it("keeps an InputGroup's disabled face off a disabled NumberField nested in its addon", () => {
    // The group owns only its own input. A disabled field nested in an addon is another
    // owner's control, so it dims itself once and leaves the enabled group at rest.
    renderStateFaces(
      <InputGroup.Root aria-label="Order line">
        <InputGroup.Input aria-label="Reference" />
        <InputGroup.Addon align="block-end">
          <NumberField label="Quantity" isDisabled defaultValue={2} />
        </InputGroup.Addon>
      </InputGroup.Root>
    );

    const group = roleNamed("group", "Order line");
    const reference = roleNamed("textbox", "Reference");
    const quantity = roleNamed("textbox", "Quantity");

    expect.soft(effectiveOpacity(group), "outer group").toBe(1);
    expect.soft(getComputedStyle(group).cursor, "outer group").not.toBe("not-allowed");
    // The group's resting field fill, not its disabled `bg-input/50`.
    expect
      .soft(getComputedStyle(group).backgroundColor, "outer group fill")
      .toBe(cssVarColor(group, "--card"));
    expect.soft(effectiveOpacity(reference), "outer enabled input").toBe(1);
    expect.soft(getComputedStyle(reference).cursor, "outer enabled input").not.toBe("not-allowed");
    expect.soft(effectiveOpacity(groupAround(quantity)), "nested number field group").toBe(0.5);
    expect.soft(effectiveOpacity(quantity), "nested number field input").toBe(0.5);
  });

  it("keeps an InputGroup's invalid ring off an invalid NumberField nested in its addon", () => {
    renderStateFaces(
      <InputGroup.Root aria-label="Order line">
        <InputGroup.Input aria-label="Reference" />
        <InputGroup.Addon align="block-end">
          <NumberField label="Quantity" isInvalid defaultValue={2} />
        </InputGroup.Addon>
      </InputGroup.Root>
    );

    expectNoRing("outer group", roleNamed("group", "Order line"));
    expectInvalidRing("nested number field group", groupAround(roleNamed("textbox", "Quantity")));
  });

  it("keeps an invalid InputGroup's solid error ring off a valid NumberField focused in its addon", async () => {
    renderStateFaces(
      <>
        <button type="button">Before</button>
        <InputGroup.Root aria-label="Order line" aria-invalid>
          <InputGroup.Input aria-label="Reference" aria-invalid />
          <InputGroup.Addon align="block-end">
            <NumberField label="Quantity" defaultValue={2} />
          </InputGroup.Addon>
        </InputGroup.Root>
      </>
    );
    const outer = roleNamed("group", "Order line");
    roleNamed("button", "Before").focus();
    // The outer group's own input takes focus first, and the outer group paints the face.
    await userEvent.keyboard("{Tab}");
    expectInvalidFocusRing("outer group, its own input focused", outer);
    expectNoRing("outer group's input while focused", roleNamed("textbox", "Reference"));
    await userEvent.keyboard("{Tab}");
    const quantity = roleNamed("textbox", "Quantity");
    expect(quantity.matches(":focus-visible"), "Tab lands on the nested field").toBe(true);

    // The nested field owns the focus: its group paints the plain ring.
    expectFocusRing(groupAround(quantity), "nested number field group");
    // Oracle: the theme's `--error` role. The outer group's own input is unfocused, so the
    // outer group must not take the focused invalid face's solid `--error` line from a control
    // it does not own. It may still paint the plain `--ring` within ring, a parked within-ring
    // gap, or its `error/20` halo; neither colour equals `--error`.
    const error = cssVarColor(outer, "--error");
    settleTransitions(outer);
    expect(
      ringLayers(outer).map((layer) => layer.color),
      "outer group takes no solid error line from a control it does not own"
    ).not.toContain(error);

    // Leaving the fields leaves the outer group its resting halo.
    await userEvent.click(page.getByText("Away", { exact: true }));
    expectInvalidRing("outer group at rest", outer);
  });

  it("still repaints the same controls under hover while they are enabled", async () => {
    renderStateFaces(
      <>
        <Button variant="outline" className="transition-none">
          Enabled button
        </Button>
        <Button variant="outline" aria-disabled="false" className="transition-none">
          Explicitly enabled button
        </Button>
        <Toggle className="transition-none">Enabled toggle</Toggle>
        <RadioGroup label="View">
          <RadioIconButton value="grid" aria-label="Enabled grid view" className="transition-none">
            <ChartBar />
          </RadioIconButton>
        </RadioGroup>
        <Tabs.Root defaultValue="account">
          <Tabs.List>
            <Tabs.Trigger value="account">Account</Tabs.Trigger>
            <Tabs.Trigger value="billing" className="transition-none">
              Enabled tab
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton className="transition-none">Enabled row</Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
        <Accordion.Root>
          <Accordion.Item value="billing">
            <Accordion.Header>
              <Accordion.Trigger className="transition-none">Enabled section</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>Billing details</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
        <Link href="/orders" className="transition-none">
          Enabled link
        </Link>
        <TextField variant="inline" label="Enabled inline field" />
      </>
    );

    const enabled = [
      ["button", roleNamed("button", "Enabled button")],
      ["aria-disabled=false button", roleNamed("button", "Explicitly enabled button")],
      ["toggle", roleNamed("button", "Enabled toggle")],
      ["radio icon button", roleNamed("radio", "Enabled grid view")],
      ["tab", roleNamed("tab", "Enabled tab")],
      ["sidebar menu button", roleNamed("button", "Enabled row")],
      ["accordion trigger", roleNamed("button", "Enabled section")],
      ["link", roleNamed("link", "Enabled link")],
      ["inline text field", roleNamed("textbox", "Enabled inline field")],
    ] as const;
    await moveAway();
    const resting = enabled.map(([, control]) => pointerPaint(control));
    for (const [index, [label, control]] of enabled.entries()) {
      await userEvent.hover(page.elementLocator(control));
      expect(pointerPaint(control), `${label} while hovered`).not.toEqual(resting[index]);
    }
  });

  it("paints the error border and ring on every invalid control", () => {
    renderStateFaces(
      <>
        <Button aria-invalid>Invalid button</Button>
        <Toggle aria-invalid>Invalid toggle</Toggle>
        <RadioGroup label="Invalid view" isInvalid>
          <RadioIconButton value="grid" aria-label="Invalid grid view">
            <ChartBar />
          </RadioIconButton>
          <Radio value="list">Invalid list view</Radio>
        </RadioGroup>
        <Checkbox aria-label="Invalid checkbox" aria-invalid />
        <CheckboxGroup label="Invalid toppings" isInvalid>
          <CheckboxItem value="mushroom">Invalid topping</CheckboxItem>
        </CheckboxGroup>
        <Switch aria-label="Invalid switch" aria-invalid />
        <Select.Root>
          <Select.Trigger aria-label="Invalid select" aria-invalid>
            <Select.Value placeholder="Pick one" />
          </Select.Trigger>
        </Select.Root>
        <Input aria-label="Invalid input" aria-invalid />
        <InputGroup.Root aria-label="Invalid group">
          <InputGroup.Input aria-label="Invalid group input" aria-invalid />
        </InputGroup.Root>
        <InputGroup.Root aria-label="Group with an invalid addon">
          <InputGroup.Input aria-label="Valid group input" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button aria-invalid>Invalid addon</InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
        <Combobox.Root items={["Apple", "Banana"]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips aria-label="Invalid fruit">
            <Combobox.Chip>Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Invalid fruit input" aria-invalid />
          </Combobox.Chips>
        </Combobox.Root>
        <NumberField label="Invalid amount" isInvalid />
        <DateField label="Invalid date" isInvalid />
      </>
    );

    for (const [label, control] of [
      ["button", roleNamed("button", "Invalid button")],
      ["toggle", roleNamed("button", "Invalid toggle")],
      ["radio icon button", roleNamed("radio", "Invalid grid view")],
      ["radio", roleNamed("radio", "Invalid list view")],
      ["checkbox", roleNamed("checkbox", "Invalid checkbox")],
      ["checkbox in an invalid group", roleNamed("checkbox", "Invalid topping")],
      ["switch", roleNamed("switch", "Invalid switch")],
      ["select trigger", roleNamed("combobox", "Invalid select")],
      ["input", roleNamed("textbox", "Invalid input")],
      ["input group", roleNamed("group", "Invalid group")],
      ["combobox chips", roleNamed("toolbar", "Invalid fruit")],
      ["number field group", groupAround(roleNamed("textbox", "Invalid amount"))],
      ["date field", roleNamed("group", "Invalid date")],
    ] as const) {
      expectInvalidRing(label, control);
    }
    // The group owns the ring, so the embedded input paints none of its own.
    expectNoRing("input group input", roleNamed("textbox", "Invalid group input"));
    // Only the embedded input's state reaches the group: an invalid addon rings itself, not
    // the group around a valid input.
    expectNoRing("input group with an invalid addon", roleNamed("group", "Group with an invalid addon"));
  });
});

/** Tab from the button named `before` and return the ring host; the ring assertions settle its transitions. */
async function tabInto(before: string, ringHost: () => HTMLElement): Promise<HTMLElement> {
  roleNamed("button", before).focus();
  await userEvent.keyboard("{Tab}");
  return ringHost();
}

describe("the focused invalid face", () => {
  it("draws a solid 1px error line inside the halo on every keyboard-focused invalid ring host", async () => {
    renderStateFaces(
      <>
        <button type="button">Before valid input</button>
        <Input aria-label="Valid input" />
        <button type="button">Before input</button>
        <Input aria-label="Invalid input" aria-invalid />
        <button type="button">Before group</button>
        <InputGroup.Root aria-label="Invalid group">
          <InputGroup.Input aria-label="Invalid group input" aria-invalid />
        </InputGroup.Root>
        <button type="button">Before number field</button>
        <NumberField label="Invalid amount" isInvalid />
        <button type="button">Before checkbox</button>
        <CheckboxGroup label="Invalid toppings" isInvalid>
          <CheckboxItem value="mushroom">Invalid topping</CheckboxItem>
        </CheckboxGroup>
        <button type="button">Before data button</button>
        <Button data-invalid="">Data-invalid button</Button>
        <button type="button">Before date field</button>
        <DateField label="Invalid date" isInvalid />
      </>
    );

    // A valid control keeps the plain ring: 2px, flush, in the theme's `--ring`.
    expectFocusRing(
      await tabInto("Before valid input", () => roleNamed("textbox", "Valid input")),
      "valid input"
    );

    // Each invalid ring host, focused from the keyboard and then left: the solid line inside
    // the halo while focused, the halo alone at rest. A within host's own control paints no
    // ring of its own while it holds the focus, so the group's face is the only one.
    const none = () => undefined;
    for (const [label, before, host, embedded] of [
      // Self target on `aria-invalid`.
      ["input", "Before input", () => roleNamed("textbox", "Invalid input"), none],
      // Within target, through the group's own invalid control.
      [
        "input group",
        "Before group",
        () => roleNamed("group", "Invalid group"),
        () => roleNamed("textbox", "Invalid group input"),
      ],
      // Within target through the group's own input, which Base UI marks `aria-invalid` from
      // the invalid Field.
      [
        "number field group",
        "Before number field",
        () => groupAround(roleNamed("textbox", "Invalid amount")),
        () => roleNamed("textbox", "Invalid amount"),
      ],
      // A Base UI root under an invalid field, which stamps `data-invalid` and `aria-invalid`.
      [
        "checkbox in an invalid group",
        "Before checkbox",
        () => roleNamed("checkbox", "Invalid topping"),
        none,
      ],
      // The data arm on its own: `data-invalid` with no `aria-invalid`.
      ["data-invalid button", "Before data button", () => roleNamed("button", "Data-invalid button"), none],
      // State target: React Aria reports focus and invalidity through render props.
      ["date field group", "Before date field", () => roleNamed("group", "Invalid date"), none],
    ] as const) {
      expectInvalidFocusRing(label, await tabInto(before, host));
      const control = embedded();
      if (control !== undefined) {
        expectNoRing(`${label} control while focused`, control);
      }
      await userEvent.click(page.getByText("Away", { exact: true }));
      expectInvalidRing(`${label} at rest`, host());
    }
  });

  it("keeps the plain focus ring on a group marked aria-invalid whose own control is valid", async () => {
    renderStateFaces(
      <>
        <button type="button">Before group</button>
        <InputGroup.Root aria-label="Flagged group" aria-invalid>
          <InputGroup.Input aria-label="Plain group input" />
        </InputGroup.Root>
        <button type="button">Before chips</button>
        <Combobox.Root items={["Apple", "Banana"]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips aria-label="Flagged chips" aria-invalid>
            <Combobox.Chip>Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Plain chips input" />
          </Combobox.Chips>
        </Combobox.Root>
      </>
    );

    // A within host reads its state from its own control only, so the group's own
    // `aria-invalid` paints no invalid face, focused or at rest.
    for (const [label, before, host] of [
      ["input group", "Before group", () => roleNamed("group", "Flagged group")],
      ["combobox chips", "Before chips", () => roleNamed("toolbar", "Flagged chips")],
    ] as const) {
      expectFocusRing(await tabInto(before, host), label);
      await userEvent.click(page.getByText("Away", { exact: true }));
      expectNoRing(`${label} at rest`, host());
    }
  });
});

describe("a Tooltip on a disabled trigger", () => {
  const TRIGGERS = [
    ["a native disabled button", <Button key="native" disabled />],
    ["a visually disabled button", <Button key="visual" isVisuallyDisabled />],
    ["a disabled toggle", <Toggle key="toggle" disabled />],
  ] as const;

  it.each(TRIGGERS)("opens on hover over %s", async (label, trigger) => {
    renderStateFaces(
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger render={trigger}>Why not</Tooltip.Trigger>
          <Tooltip.Content>{`Reason for ${label}`}</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );

    await userEvent.hover(page.elementLocator(roleNamed("button", "Why not")), { force: true });
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip", { name: `Reason for ${label}` }).query()).not.toBeNull();
    });
  });
});
