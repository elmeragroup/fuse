import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { withLocale } from "../../test/locale-matrix";
import { bySlot, Frame as SidebarFrame, setupSidebarBrowser } from "../../test/sidebar-browser-fixtures";
import { fkasPrivate, guenExternal } from "../../test/theme-fixtures";
import type { QueryableRole } from "../../test/themed-browser-render";
import { cssVarColor, px, roleNamed, textNamed } from "../../test/themed-browser-render";
import { Accordion } from "../components/accordion";
import { Badge } from "../components/badge/badge";
import { ButtonGroup } from "../components/button-group";
import { Card } from "../components/card/card";
import { DescriptionList } from "../components/description-list/description-list";
import { Frame } from "../components/frame/frame";
import { Sheet } from "../components/sheet";
import { Table } from "../components/table/table";
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
 * The parts with a bare `border*` width, plus a Card whose `border-error` utility must win
 * over the base default. An external `primary` can equal the text colour, but the error role is
 * a status hue, so the check against the text colour stays meaningful in every scope. The first
 * Term and Details drop their border, so the second pair is read; the last body row drops its
 * own, so the first is.
 */
const PARTS: readonly BareBorder[] = [
  { name: "DescriptionList Term", find: () => textNamed("Meter point"), side: "Top", token: "--border" },
  { name: "DescriptionList Details", find: () => textNamed("7070575000"), side: "Top", token: "--border" },
  { name: "Card", find: () => roleNamed("group", "Card"), side: "Top", token: "--border" },
  { name: "outline Badge", find: () => textNamed("Outline"), side: "Top", token: "--border" },
  { name: "Table row", find: () => roleNamed("row", "Row one"), side: "Bottom", token: "--border" },
  { name: "ButtonGroupText", find: () => textNamed("https://"), side: "Top", token: "--border" },
  { name: "FramePanel", find: () => roleNamed("group", "Panel"), side: "Top", token: "--border" },
  { name: "card Accordion item", find: () => roleNamed("group", "Item"), side: "Top", token: "--border" },
  { name: "Sheet popup", find: () => roleNamed("dialog", "Meter details"), side: "Left", token: "--border" },
  // DOM audit: the container has no role; Sidebar suites reach it by slot.
  {
    name: "Sidebar container",
    find: () => bySlot("sidebar-container"),
    side: "Right",
    token: "--sidebar-border",
  },
  {
    name: "border-error Card",
    find: () => roleNamed("group", "Error card"),
    side: "Top",
    token: "--error",
  },
];

function BareBorderParts() {
  return withLocale(
    "en-US",
    <>
      <DescriptionList.Root>
        <DescriptionList.Content>
          <DescriptionList.Term>Name</DescriptionList.Term>
          <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
          <DescriptionList.Term>Meter point</DescriptionList.Term>
          <DescriptionList.Details>7070575000</DescriptionList.Details>
        </DescriptionList.Content>
      </DescriptionList.Root>
      <Card.Root role="group" aria-label="Card" />
      <Card.Root role="group" aria-label="Error card" className="border-error" />
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
      <Accordion.Root variant="card">
        <Accordion.Item value="one" role="group" aria-label="Item">
          <Accordion.Header>
            <Accordion.Trigger>One</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
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
    expect(cssVarColor(roleNamed("group", "Card"), "--border")).not.toBe(
      cssVarColor(roleNamed("group", "Outer"), "--border")
    );
  });
});
