import type { ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { fkasExternal, fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import {
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDocumentTheme,
  textNamed,
} from "../../test/themed-browser-render";
import { Badge } from "../components/badge/badge";
import { Button } from "../components/button/button";
import { Card } from "../components/card/card";
import { Checkbox } from "../components/checkbox/checkbox";
import { Frame } from "../components/frame/frame";
import { InputGroup } from "../components/input-group/input-group";
import { Input } from "../components/input/input";
import { Tabs } from "../components/tabs/tabs";
import { Toggle } from "../components/toggle/toggle";
import { Calendar } from "../react-aria/calendar/calendar";
import { UiProviders } from "../react-aria/ui-providers/ui-providers";
import { ThemeScope } from "./theme-scope";
import type { ThemeInput } from "./tokens/themes";

const BUTTON_SIZES = ["default", "xs", "sm", "lg"] as const;
const ICON_BUTTON_SIZES = ["icon", "icon-xs", "icon-sm", "icon-lg"] as const;

type Specimen =
  | "button"
  | "card"
  | "input"
  | "badge"
  | "toggle"
  | "toggle-xs"
  | "checkbox"
  | "input-group"
  | "input-group-button"
  | "frame"
  | "calendar"
  | "tab";

/**
 * Hand-computed corner radii in px from each theme's palette literals and the `fuse.css`
 * rung formulas. Internal: `--radius` 0.375rem (6px), step 0, and the button radius
 * aliases `--radius`. fkas: 0.75rem (12px), step 2px, button 1.8125rem (29px). tkas:
 * 0.95rem (15.2px), step 2px, button 0.95rem. `rounded-md` is one step inside `--radius`,
 * `rounded-xl` two steps outside, and the input-group addon 2.5 steps inside. The checkbox
 * caps at 4px and the xs toggle at 10px.
 */
const EXPECTED = {
  internal: {
    button: 6,
    card: 6,
    input: 6,
    badge: 6,
    toggle: 6,
    "toggle-xs": 6,
    checkbox: 4,
    "input-group": 6,
    "input-group-button": 6,
    frame: 6,
    calendar: 6,
    tab: 6,
  },
  fkas: {
    button: 29,
    card: 12,
    input: 10,
    badge: 12,
    toggle: 10,
    "toggle-xs": 10,
    checkbox: 4,
    "input-group": 10,
    "input-group-button": 7,
    frame: 16,
    calendar: 12,
    tab: 10,
  },
  tkas: {
    button: 15.2,
    card: 15.2,
    input: 13.2,
    badge: 15.2,
    toggle: 13.2,
    "toggle-xs": 10,
    checkbox: 4,
    "input-group": 13.2,
    "input-group-button": 10.2,
    frame: 19.2,
    calendar: 15.2,
    tab: 13.2,
  },
} as const satisfies Record<"internal" | "fkas" | "tkas", Record<Specimen, number>>;

function Specimens(): ReactElement {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      {BUTTON_SIZES.map((size) => (
        <Button key={size} size={size}>{`Button ${size}`}</Button>
      ))}
      {ICON_BUTTON_SIZES.map((size) => (
        <Button key={size} size={size} aria-label={`Button ${size}`} />
      ))}
      <Card.Root role="group" aria-label="Card" />
      <Input aria-label="Input" />
      <Badge>Badge</Badge>
      <Toggle>Toggle</Toggle>
      <Toggle size="xs">Toggle xs</Toggle>
      <Checkbox aria-label="Checkbox" />
      <InputGroup.Root aria-label="Input group">
        <InputGroup.Input aria-label="Grouped input" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button size="xs">Addon xs</InputGroup.Button>
          <InputGroup.Button size="sm">Addon sm</InputGroup.Button>
          <InputGroup.Button size="icon-xs" aria-label="Addon icon-xs" />
          <InputGroup.Button size="icon-sm" aria-label="Addon icon-sm" />
        </InputGroup.Addon>
      </InputGroup.Root>
      <Frame.Root role="group" aria-label="Frame" />
      <Calendar aria-label="Calendar" />
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">Tab</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </UiProviders>
  );
}

/** The one calendar root. React Aria appends the visible month to its accessible name. */
function calendarRoot(): HTMLElement {
  const element = page.getByRole("application", { name: /^Calendar/ }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the calendar application root");
  }
  return element;
}

function radius(element: HTMLElement): number {
  return px(getComputedStyle(element).borderTopLeftRadius);
}

/** Every specimen's corner radius, keyed by the element it stands for. */
function measure(): readonly (readonly [Specimen, string, number])[] {
  const buttonNames = [...BUTTON_SIZES, ...ICON_BUTTON_SIZES].map((size) => `Button ${size}`);
  return [
    ...buttonNames.map((name) => ["button", name, radius(roleNamed("button", name))] as const),
    ["card", "Card", radius(roleNamed("group", "Card"))],
    ["input", "Input", radius(roleNamed("textbox", "Input"))],
    ["badge", "Badge", radius(textNamed("Badge"))],
    ["toggle", "Toggle", radius(roleNamed("button", "Toggle"))],
    ["toggle-xs", "Toggle xs", radius(roleNamed("button", "Toggle xs"))],
    ["checkbox", "Checkbox", radius(roleNamed("checkbox", "Checkbox"))],
    ["input-group", "Input group", radius(roleNamed("group", "Input group"))],
    ...["Addon xs", "Addon sm", "Addon icon-xs", "Addon icon-sm"].map(
      (name) => ["input-group-button", name, radius(roleNamed("button", name))] as const
    ),
    ["frame", "Frame", radius(roleNamed("group", "Frame"))],
    ["calendar", "Calendar", radius(calendarRoot())],
    ["tab", "Tab", radius(roleNamed("tab", "Tab"))],
  ];
}

function expectRadii(variant: keyof typeof EXPECTED, context: string): void {
  for (const [element, name, measured] of measure()) {
    expect(measured, `${context} ${name}`).toBeCloseTo(EXPECTED[variant][element], 1);
  }
}

const CASES: readonly (readonly [keyof typeof EXPECTED, ThemeInput, ThemeInput])[] = [
  // Each case names the theme under test and a document theme with different radii, so a
  // value resolved against the document root instead of the scope shows up as a mismatch.
  ["internal", fkasPrivate, tkasCompany],
  ["fkas", fkasExternal, fkasPrivate],
  ["tkas", tkasCompany, fkasPrivate],
];

describe("radius roles", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  it("rounds every element from the document theme's radius roles", () => {
    for (const [variant, theme] of CASES) {
      stampDocumentTheme(theme, "light");
      const { unmount } = render(<Specimens />);
      expectRadii(variant, `document ${variant}`);
      unmount();
    }
  });

  it("rounds a nested theme scope from its own radius roles, not the document's", () => {
    for (const [variant, theme, documentTheme] of CASES) {
      stampDocumentTheme(documentTheme, "light");
      const { unmount } = render(
        <ThemeScope theme={theme}>
          <Specimens />
        </ThemeScope>
      );
      expectRadii(variant, `scope ${variant}`);
      unmount();
    }
  });

  it("gives every internal button, card and field the same radius", () => {
    stampDocumentTheme(fkasPrivate, "light");
    render(<Specimens />);
    const uniform = measure().filter(([element]) => element !== "checkbox");
    const radii = new Set(uniform.map(([, , measured]) => measured));
    expect([...radii]).toEqual([6]);
  });
});
