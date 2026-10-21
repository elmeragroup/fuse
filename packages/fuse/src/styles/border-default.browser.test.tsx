import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { withLocale } from "../../test/locale-matrix";
import { bySlot, Frame as SidebarFrame, setupSidebarBrowser } from "../../test/sidebar-browser-fixtures";
import { fkasPrivate, fkseExternal, guenExternal } from "../../test/theme-fixtures";
import type { QueryableRole } from "../../test/themed-browser-render";
import { cssVarColor, fieldRootFrom, px, roleNamed, textNamed } from "../../test/themed-browser-render";
import { Accordion } from "../components/accordion";
import { Badge } from "../components/badge/badge";
import { ButtonGroup } from "../components/button-group";
import { Card } from "../components/card/card";
import { CheckboxCard } from "../components/checkbox-card/checkbox-card";
import { CheckboxGroup } from "../components/checkbox/checkbox";
import { DescriptionList } from "../components/description-list/description-list";
import { Frame } from "../components/frame/frame";
import { Sheet } from "../components/sheet";
import { Table } from "../components/table/table";
import { TextField } from "../components/text-field/text-field";
import { ThemeScope } from "../theme/theme-scope";

type Side = "Top" | "Right" | "Bottom" | "Left";

/** A part that sets a border width and no colour class, the side it draws and the role it reads. */
type BareBorder = {
  readonly name: string;
  readonly find: () => HTMLElement;
  readonly side: Side;
  readonly token: "--border" | "--sidebar-border" | "--error";
};

/**
 * The parts with a bare `border*` width. Card and the `card` Accordion item read `--card-border`
 * instead, which the card edge suite below covers. The first DescriptionList Item, and the first
 * Term and Details in an Item, drop their border, so the second ones are read; the last body row
 * drops its own, so the first is.
 */
const PARTS: readonly BareBorder[] = [
  {
    name: "DescriptionList Item",
    // DOM audit: an Item is a bare div around its term and details, with no role or text of its own.
    find: () => parentOf(textNamed("Meter point")),
    side: "Top",
    token: "--border",
  },
  { name: "DescriptionList Term", find: () => textNamed("Metering point"), side: "Top", token: "--border" },
  { name: "DescriptionList Details", find: () => textNamed("7070575001"), side: "Top", token: "--border" },
  { name: "outline Badge", find: () => textNamed("Outline"), side: "Top", token: "--border" },
  { name: "Table row", find: () => roleNamed("row", "Row one"), side: "Bottom", token: "--border" },
  { name: "ButtonGroupText", find: () => textNamed("https://"), side: "Top", token: "--border" },
  { name: "FramePanel", find: () => roleNamed("group", "Panel"), side: "Top", token: "--border" },
  { name: "Sheet popup", find: () => roleNamed("dialog", "Meter details"), side: "Left", token: "--border" },
  // DOM audit: the container has no role; Sidebar suites reach it by slot.
  {
    name: "Sidebar container",
    find: () => bySlot("sidebar-container"),
    side: "Right",
    token: "--sidebar-border",
  },
];

/** The element around `element`. */
function parentOf(element: HTMLElement): HTMLElement {
  const parent = element.parentElement;
  if (parent === null) {
    throw new Error(`expected a parent around ${element.textContent}`);
  }
  return parent;
}

function BareBorderParts() {
  return withLocale(
    "en-US",
    <>
      <DescriptionList.Root>
        <DescriptionList.Content>
          <DescriptionList.Item>
            <DescriptionList.Term>Name</DescriptionList.Term>
            <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Meter point</DescriptionList.Term>
            <DescriptionList.Term>Metering point</DescriptionList.Term>
            <DescriptionList.Details>7070575000</DescriptionList.Details>
            <DescriptionList.Details>7070575001</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      </DescriptionList.Root>
      <div role="group" aria-label="Probe" />
      <Badge variant="outline">Outline</Badge>
      <Table.Root>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Row one</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Row two</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
      <ButtonGroup.Root aria-label="Prefixed">
        <ButtonGroup.Text>https://</ButtonGroup.Text>
      </ButtonGroup.Root>
      <Frame.Root>
        <Frame.Panel role="group" aria-label="Panel" />
      </Frame.Root>
      <SidebarFrame />
      <Sheet.Root defaultOpen modal={false}>
        <Sheet.Content>
          <Sheet.Header>
            <Sheet.Title>Meter details</Sheet.Title>
          </Sheet.Header>
        </Sheet.Content>
      </Sheet.Root>
    </>
  );
}

/** Each part's border on its bordered side resolves the role where the part sits, not its text colour. */
async function expectRoleBorders(): Promise<void> {
  await expect.element(page.getByRole("dialog", { name: "Meter details" })).toBeVisible();
  for (const part of PARTS) {
    const element = part.find();
    const style = getComputedStyle(element);
    const color = style[`border${part.side}Color`];
    expect.soft(px(style[`border${part.side}Width`]), `${part.name} border width`).toBeGreaterThan(0);
    expect.soft(color, part.name).toBe(cssVarColor(element, part.token));
    expect.soft(color, `${part.name} against its text colour`).not.toBe(style.color);
  }
}

/** A host native widget outside any Fuse part, the role it exposes and how to render it with extra props. */
type HostWidget = {
  readonly name: string;
  readonly role: QueryableRole;
  readonly render: (props: { "aria-label": string; style?: CSSProperties }) => ReactNode;
};

/** Host widgets whose native look any author border colour would turn off. */
const HOST_WIDGETS: readonly HostWidget[] = [
  { name: "Button", role: "button", render: (props) => <button type="button" {...props} /> },
  {
    name: "Select",
    role: "combobox",
    render: (props) => (
      <select {...props}>
        <option>One</option>
      </select>
    ),
  },
  { name: "Textarea", role: "textbox", render: (props) => <textarea {...props} /> },
  { name: "Text input", role: "textbox", render: (props) => <input type="text" {...props} /> },
  { name: "Progress", role: "progressbar", render: (props) => <progress value={0.5} max={1} {...props} /> },
  { name: "Meter", role: "meter", render: (props) => <meter value={0.5} {...props} /> },
];

const SCOPES = {
  "internal light": (node: ReactNode) => <ThemeScope theme={fkasPrivate}>{node}</ThemeScope>,
  "internal dark": (node: ReactNode) => (
    <div data-theme="dark">
      <ThemeScope theme={fkasPrivate}>{node}</ThemeScope>
    </div>
  ),
  "external guen": (node: ReactNode) => <ThemeScope theme={guenExternal}>{node}</ThemeScope>,
} as const;

describe("the base-layer border default", () => {
  setupSidebarBrowser();

  it.each(Object.entries(SCOPES))("draws bare borders in the border role, %s", async (_, scope) => {
    render(scope(<BareBorderParts />));
    await expectRoleBorders();
  });

  it("draws the Sidebar rail edge in the sidebar role where it differs from the border role", () => {
    render(SCOPES["external guen"](withLocale("en-US", <SidebarFrame />)));
    const container = bySlot("sidebar-container");
    const role = cssVarColor(container, "--sidebar-border");
    expect(role, "precondition: the sidebar role differs from the border role").not.toBe(
      cssVarColor(container, "--border")
    );
    expect(getComputedStyle(container).borderRightColor).toBe(role);
  });

  it("leaves host native widgets their own border colour and gives a host rule the border role", () => {
    render(
      SCOPES["internal light"](
        <>
          {HOST_WIDGETS.map((widget) => (
            <Fragment key={widget.name}>
              {widget.render({ "aria-label": widget.name })}
              {widget.render({ "aria-label": `${widget.name} twin`, style: { borderColor: "revert" } })}
            </Fragment>
          ))}
          <hr aria-label="Rule" />
        </>
      )
    );
    // `revert` rolls the twin back to the UA border colour, the oracle for an untouched host widget.
    for (const widget of HOST_WIDGETS) {
      const host = roleNamed(widget.role, widget.name);
      const twin = roleNamed(widget.role, `${widget.name} twin`);
      expect
        .soft(getComputedStyle(host).borderTopColor, widget.name)
        .toBe(getComputedStyle(twin).borderTopColor);
    }
    const rule = roleNamed("separator", "Rule");
    expect(getComputedStyle(rule).borderTopColor).toBe(cssVarColor(rule, "--border"));
  });

  it("reads the inner scope's border role in an external scope inside an internal dark one", async () => {
    render(
      <div data-theme="dark">
        <ThemeScope theme={fkasPrivate}>
          <div role="group" aria-label="Outer" />
          <ThemeScope theme={guenExternal}>
            <BareBorderParts />
          </ThemeScope>
        </ThemeScope>
      </div>
    );
    await expectRoleBorders();
    expect(cssVarColor(roleNamed("group", "Probe"), "--border")).not.toBe(
      cssVarColor(roleNamed("group", "Outer"), "--border")
    );
  });
});

const CARD_RADII = ["none", "lg", "xl"] as const;

/** The parts that draw their edge in `--card-border`. */
const CARD_EDGES: readonly { readonly name: string; readonly find: () => HTMLElement }[] = [
  { name: "Card", find: () => roleNamed("group", "Card") },
  ...CARD_RADII.map((radius) => ({
    name: `card Accordion item, ${radius} radius`,
    find: () => roleNamed("group", `Item ${radius}`),
  })),
];

/** The parts built on the Card recipe that keep the `--border` edge. */
const BORDER_KEEPERS: readonly { readonly name: string; readonly find: () => HTMLElement }[] = [
  {
    name: "CheckboxCard",
    // DOM audit: the CheckboxCard edge is on Card.Root, which exposes its `card` slot.
    find: () => {
      const root = textNamed("Roadside").closest("[data-slot=card]");
      if (!(root instanceof HTMLElement)) throw new Error("expected the CheckboxCard's card root");
      return root;
    },
  },
  { name: "TextField card", find: () => fieldRootFrom("Annual usage") },
];

function CardEdgeParts() {
  return withLocale(
    "en-US",
    <>
      <Card.Root role="group" aria-label="Card" />
      <Card.Root role="group" aria-label="Error card" className="border-error" />
      {CARD_RADII.map((radius) => (
        <Accordion.Root key={radius} variant="card" radius={radius}>
          <Accordion.Item value="one" role="group" aria-label={`Item ${radius}`}>
            <Accordion.Header>
              <Accordion.Trigger>One</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>
      ))}
      <Accordion.Root variant="card">
        <Accordion.Item value="one" role="group" aria-label="Error item" className="border-error">
          <Accordion.Header>
            <Accordion.Trigger>One</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
      <CheckboxGroup>
        <CheckboxCard value="roadside" title="Roadside" description="Towing included." />
      </CheckboxGroup>
      <TextField variant="card" label="Annual usage" placeholder="0" />
    </>
  );
}

const SIDES: readonly Side[] = ["Top", "Right", "Bottom", "Left"];

/** Each side's computed width and colour. */
function edges(element: HTMLElement): readonly { side: Side; width: number; color: string }[] {
  const style = getComputedStyle(element);
  return SIDES.map((side) => ({
    side,
    width: px(style[`border${side}Width`]),
    color: style[`border${side}Color`],
  }));
}

function alphaOf(serialized: string): number {
  return getOrThrow(CssColor.parse(serialized)).alpha;
}

/** The `--border` edge the Card recipe's other consumers keep, visible in every scope. */
function expectBorderKeepers(): void {
  for (const part of BORDER_KEEPERS) {
    const element = part.find();
    const border = cssVarColor(element, "--border");
    expect(alphaOf(border), `${part.name}: precondition, a visible border role`).toBeGreaterThan(0);
    for (const { side, width, color } of edges(element)) {
      expect.soft(width, `${part.name} ${side} width`).toBe(1);
      expect.soft(color, `${part.name} ${side}`).toBe(border);
    }
  }
}

/**
 * A border colour class on a Card or a card Accordion item beats the card edge role. An external
 * `primary` can equal the text colour, but the error role is a status hue in every scope.
 */
function expectClassOverride(): void {
  for (const name of ["Error card", "Error item"]) {
    const part = roleNamed("group", name);
    expect.soft(getComputedStyle(part).borderTopColor, name).toBe(cssVarColor(part, "--error"));
  }
}

describe("the card edge role", () => {
  it.each([
    ["internal light", (node: ReactNode) => <ThemeScope theme={fkasPrivate}>{node}</ThemeScope>],
    [
      "internal dark",
      (node: ReactNode) => (
        <div data-theme="dark">
          <ThemeScope theme={fkasPrivate}>{node}</ThemeScope>
        </div>
      ),
    ],
  ] as const)("draws cards in the border role, %s", (_, scope) => {
    render(scope(<CardEdgeParts />));
    for (const part of CARD_EDGES) {
      const element = part.find();
      const border = cssVarColor(element, "--border");
      for (const { side, width, color } of edges(element)) {
        expect.soft(width, `${part.name} ${side} width`).toBe(1);
        expect.soft(color, `${part.name} ${side}`).toBe(border);
      }
    }
    expectBorderKeepers();
    expectClassOverride();
  });

  it.each([
    ["guen light", guenExternal, false],
    ["fkse light", fkseExternal, false],
    ["guen dark", guenExternal, true],
    ["fkse dark", fkseExternal, true],
  ] as const)("draws external cards with a transparent 1px edge, %s", (_, theme, dark) => {
    const scoped = (
      <ThemeScope theme={theme}>
        <CardEdgeParts />
      </ThemeScope>
    );
    render(dark ? <div data-theme="dark">{scoped}</div> : scoped);
    for (const part of CARD_EDGES) {
      for (const { side, width, color } of edges(part.find())) {
        expect.soft(width, `${part.name} ${side} width`).toBe(1);
        expect.soft(alphaOf(color), `${part.name} ${side} alpha`).toBe(0);
      }
    }
    expectBorderKeepers();
    expectClassOverride();
  });

  it("takes a --card-border override from any wrapper, but not a --border one", () => {
    render(
      <ThemeScope theme={fkasPrivate}>
        <div role="group" aria-label="Theme probe" />
        <div style={{ "--card-border": "rgb(200, 0, 0)" }}>
          <Card.Root role="group" aria-label="Recoloured" />
        </div>
        <div style={{ "--border": "rgb(0, 0, 200)" }}>
          <Card.Root role="group" aria-label="Wrapped" />
        </div>
      </ThemeScope>
    );
    expect(getComputedStyle(roleNamed("group", "Recoloured")).borderTopColor).toBe("rgb(200, 0, 0)");
    // The role resolves on the theme element, so the Card keeps the theme's own border colour.
    const themeBorder = cssVarColor(roleNamed("group", "Theme probe"), "--border");
    expect(themeBorder, "precondition: the theme border differs from the wrapper's").not.toBe(
      "rgb(0, 0, 200)"
    );
    expect(getComputedStyle(roleNamed("group", "Wrapped")).borderTopColor).toBe(themeBorder);
  });
});
