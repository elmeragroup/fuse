import type { ReactNode } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { expectInvalidRing, expectNoRing } from "../../test/assert-invalid-ring";
import { withLocale } from "../../test/locale-matrix";
import { whilePointerPressed } from "../../test/pointer-press";
import { effectiveOpacity, renderThemed, roleNamed, stampDensity } from "../../test/themed-browser-render";
import { Accordion } from "../components/accordion/accordion";
import { Button } from "../components/button/button";
import { CheckboxCard } from "../components/checkbox-card/checkbox-card";
import { Checkbox, CheckboxGroup, CheckboxItem } from "../components/checkbox/checkbox";
import { Combobox } from "../components/combobox/combobox";
import { InputGroup } from "../components/input-group/input-group";
import { Input } from "../components/input/input";
import { NumberField } from "../components/number-field/number-field";
import { Radio, RadioGroup, RadioIconButton } from "../components/radio-group/radio-group";
import { Select } from "../components/select/select";
import { Sidebar } from "../components/sidebar/sidebar";
import { Switch } from "../components/switch/switch";
import { Tabs } from "../components/tabs/tabs";
import { TextField } from "../components/text-field/text-field";
import { ToggleGroup } from "../components/toggle-group/toggle-group";
import { Toggle } from "../components/toggle/toggle";
import { Tooltip } from "../components/tooltip/tooltip";
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

const DENSITIES = ["dense", "comfortable"] as const;

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

describe.each(DENSITIES)("state face at %s density", (density) => {
  beforeEach(() => {
    stampDensity(density);
  });

  it("keeps every disabled control's paint and position still under hover and press", async () => {
    renderStateFaces(<DisabledControls />);

    for (const [label, find] of DISABLED_CONTROLS) {
      const control = find();
      await moveAway();
      const resting = pointerPaint(control);

      // `force` skips Playwright's hit-target wait, so a control that drops pointer
      // events is still reached and its failure is the paint, not a timeout.
      await userEvent.hover(page.elementLocator(control), { force: true });
      expect.soft(pointerPaint(control), `${label} while hovered`).toEqual(resting);
      const pressed = await whilePointerPressed(() => pointerPaint(control));
      expect.soft(pressed, `${label} while pressed`).toEqual(resting);
    }
  });

  it("shows the not-allowed cursor on every disabled control", async () => {
    renderStateFaces(<DisabledControls />);

    for (const [label, find] of DISABLED_CONTROLS) {
      const control = find();
      await userEvent.hover(page.elementLocator(control), { force: true });
      expect.soft(getComputedStyle(control).cursor, label).toBe("not-allowed");
    }
  });

  it("dims every disabled control to half opacity once", () => {
    renderStateFaces(<DisabledControls />);

    for (const [label, find] of DISABLED_CONTROLS) {
      const control = find();
      // A control inside a group (an input, a stepper) is dimmed by the group, so it paints
      // at the group's 0.5 rather than a doubled 0.25.
      expect.soft(effectiveOpacity(control), label).toBe(0.5);
    }
  });

  it("dims an InputGroup once and shows the not-allowed cursor when its input is aria-disabled", async () => {
    // Not in the pointer-paint list: an `aria-disabled` input stays focusable, so a press
    // focuses it and the group paints its focus border, which is focus, not a press face.
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
    expect.soft(getComputedStyle(group).backgroundColor, "outer group fill").toBe("rgba(0, 0, 0, 0)");
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

    for (const [label, control] of [
      ["button", roleNamed("button", "Enabled button")],
      ["aria-disabled=false button", roleNamed("button", "Explicitly enabled button")],
      ["toggle", roleNamed("button", "Enabled toggle")],
      ["radio icon button", roleNamed("radio", "Enabled grid view")],
      ["tab", roleNamed("tab", "Enabled tab")],
      ["sidebar menu button", roleNamed("button", "Enabled row")],
      ["accordion trigger", roleNamed("button", "Enabled section")],
      ["link", roleNamed("link", "Enabled link")],
      ["inline text field", roleNamed("textbox", "Enabled inline field")],
    ] as const) {
      await moveAway();
      const resting = pointerPaint(control);
      await userEvent.hover(page.elementLocator(control));
      expect(pointerPaint(control), `${label} while hovered`).not.toEqual(resting);
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
