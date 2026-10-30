import type { ReactElement } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  ringLayers,
  settleTransitions,
  shadowLayerLengths,
  shadowLayers,
} from "../../../test/assert-invalid-ring";
import { cornerRadius, RADIUS_XL } from "../../../test/inner-corner-specimens";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { tkasCompany } from "../../../test/theme-fixtures";
import {
  cssVarColor,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { CaretDown } from "../../icons/generated/caret-down";
import { DENSITIES } from "../../theme/density";
import { ThemeScope } from "../../theme/theme-scope";
import { Collapsible } from "../collapsible";
import { Table, VerticalTable } from "../table/table";
import { Frame } from "./frame";
import type { FrameLayout } from "./frame";

/**
 * The tkas corners in px, written out by hand from its `rounded-xl` of 20px: a padded Frame hands
 * its items that corner less its 1px border and 4px small-tier padding, and a flush Frame hands
 * them its own `rounded-xl`, because they pull over its border.
 */
const PADDED_ITEM_CORNER = RADIUS_XL.tkas - 1 - 4;
const FLUSH_ITEM_CORNER = RADIUS_XL.tkas;

function frameRoot(label: string): HTMLElement {
  const root = roleNamed("region", label).firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected frame root in ${label}`);
  }
  return root;
}

afterEach(async () => {
  await emulateReducedMotion("no-preference");
  document.documentElement.removeAttribute("data-density");
});

describe("Frame", () => {
  it("renders children in order and emits each part's data-slot", () => {
    renderThemed(
      <section aria-label="Invoice frame">
        <Frame.Root>
          <Frame.Header>
            <Frame.Title>Invoices</Frame.Title>
            <Frame.Description>Last 30 days</Frame.Description>
          </Frame.Header>
          <Frame.Panel>March</Frame.Panel>
          <Frame.Footer>Export</Frame.Footer>
        </Frame.Root>
      </section>
    );
    const root = frameRoot("Invoice frame");
    expect(root.getAttribute("data-slot")).toBe("frame");
    expect([...root.children].map((child) => child.getAttribute("data-slot"))).toEqual([
      "frame-panel-header",
      "frame-panel",
      "frame-panel-footer",
    ]);
    expect(textNamed("Invoices").getAttribute("data-slot")).toBe("frame-panel-title");
    expect(textNamed("Last 30 days").getAttribute("data-slot")).toBe("frame-panel-description");
  });

  it("renders real header and footer elements without landmark roles under the div root", () => {
    renderThemed(
      <main>
        <section aria-label="Invoice frame">
          <Frame.Root>
            <Frame.Header>
              <Frame.Title>Invoices</Frame.Title>
            </Frame.Header>
            <Frame.Panel>March</Frame.Panel>
            <Frame.Footer>Export</Frame.Footer>
          </Frame.Root>
        </section>
      </main>
    );
    const title = textNamed("Invoices");
    const header = title.parentElement;
    const footer = textNamed("Export");
    const root = frameRoot("Invoice frame");
    expect(header?.tagName).toBe("HEADER");
    expect(footer.tagName).toBe("FOOTER");
    expect(root.tagName).toBe("DIV");
    expect(header?.getAttribute("role")).toBeNull();
    expect(footer.getAttribute("role")).toBeNull();
    expect(page.getByRole("banner").elements()).toEqual([]);
    expect(page.getByRole("contentinfo").elements()).toEqual([]);
  });

  it("draws a 1px border round the root and pads its bars to the panel text inline and half the panel padding on the block axis", () => {
    renderThemed(
      <section aria-label="Invoice frame">
        <Frame.Root>
          <Frame.Header>
            <Frame.Title>Invoices</Frame.Title>
          </Frame.Header>
          <Frame.Panel>March</Frame.Panel>
          <Frame.Footer>Export</Frame.Footer>
        </Frame.Root>
      </section>
    );
    const root = getComputedStyle(frameRoot("Invoice frame"));
    expect(root.borderTopWidth).toBe("1px");
    expect(root.borderLeftWidth).toBe("1px");
    expect(root.backgroundClip).toBe("padding-box");
    // The large surface tier pads 16px dense and 24px comfortable. The bars take half of it above
    // and below, and inline the panel's 1px border and the tier, so their text starts where a
    // panel's does.
    for (const [density, panelPad] of [
      ["dense", 16],
      ["comfortable", 24],
    ] as const) {
      stampDensity(density);
      const panel = getComputedStyle(textNamed("March"));
      expect(px(panel.paddingTop), `${density} panel`).toBe(panelPad);
      for (const bar of [textNamed("Invoices").parentElement, textNamed("Export")]) {
        if (bar === null) {
          throw new Error("expected the header around the title");
        }
        const style = getComputedStyle(bar);
        expect(px(style.paddingLeft), `${density} ${bar.tagName} inline`).toBe(1 + panelPad);
        expect(px(style.paddingTop), `${density} ${bar.tagName} block`).toBe(panelPad / 2);
      }
    }
  });

  it("separates adjacent panels with a 4px muted gutter by default and fuses them in the stacked layout", () => {
    const { unmount } = renderThemed(
      <Frame.Root>
        <Frame.Panel>March</Frame.Panel>
        <Frame.Panel>April</Frame.Panel>
      </Frame.Root>
    );
    const second = textNamed("April");
    expect(getComputedStyle(second).marginTop).toBe("4px");
    expect(getComputedStyle(second).borderTopWidth).not.toBe("0px");
    unmount();

    renderThemed(
      <Frame.Root layout="stacked">
        <Frame.Panel>March</Frame.Panel>
        <Frame.Panel>April</Frame.Panel>
      </Frame.Root>
    );
    const first = textNamed("March");
    const fused = textNamed("April");
    expect(getComputedStyle(first).borderBottomLeftRadius).toBe("0px");
    expect(getComputedStyle(first).borderBottomRightRadius).toBe("0px");
    expect(getComputedStyle(fused).borderTopLeftRadius).toBe("0px");
    expect(getComputedStyle(fused).borderTopRightRadius).toBe("0px");
    expect(getComputedStyle(fused).borderTopWidth).toBe("0px");
    expect(getComputedStyle(fused).marginTop).toBe("0px");
    expect(getComputedStyle(first, "::before").display).toBe("none");
  });

  it("runs flush panels to the root's edges, rounding them with the root's own corner", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <section aria-label="Bare frame">
          <Frame.Root layout="flush">
            <Frame.Panel>March</Frame.Panel>
            <Frame.Panel>April</Frame.Panel>
          </Frame.Root>
        </section>
        <section aria-label="Headed frame">
          <Frame.Root layout="flush">
            <Frame.Header>
              <Frame.Title>Usage</Frame.Title>
            </Frame.Header>
            <Frame.Panel>May</Frame.Panel>
            <Frame.Footer>Exported</Frame.Footer>
          </Frame.Root>
        </section>
        <section aria-label="Sectioned frame">
          <Frame.Root layout="flush">
            <Collapsible.Root defaultOpen>
              <Collapsible.Content>
                <Frame.Panel>June</Frame.Panel>
              </Collapsible.Content>
              <Collapsible.Trigger>Hide June</Collapsible.Trigger>
            </Collapsible.Root>
          </Frame.Root>
        </section>
      </ThemeScope>
    );
    const bare = frameRoot("Bare frame");
    const edges = bare.getBoundingClientRect();
    expect(getComputedStyle(bare).paddingTop).toBe("0px");
    expect(cornerRadius(bare)).toBe(RADIUS_XL.tkas);

    // The two panels fill the root's border box: the first starts on its top edge, the last ends
    // on its bottom edge, and both lie on its sides, so their own borders draw its edge.
    const march = textNamed("March");
    const april = textNamed("April");
    for (const panel of [march, april]) {
      const box = panel.getBoundingClientRect();
      expect(box.left, panel.textContent).toBe(edges.left);
      expect(box.right, panel.textContent).toBe(edges.right);
      expect(getComputedStyle(panel, "::before").display).toBe("none");
    }
    expect(march.getBoundingClientRect().top).toBe(edges.top);
    expect(april.getBoundingClientRect().bottom).toBe(edges.bottom);
    // Adjacent flush panels fuse as stacked ones do, keeping the root's corner on the outer ends.
    expect(cornerRadius(march)).toBe(FLUSH_ITEM_CORNER);
    expect(px(getComputedStyle(march).borderBottomLeftRadius)).toBe(0);
    expect(cornerRadius(april)).toBe(0);
    expect(px(getComputedStyle(april).borderBottomLeftRadius)).toBe(FLUSH_ITEM_CORNER);
    expect(getComputedStyle(april).borderTopWidth).toBe("0px");

    // Under a header the panel starts below the band and keeps its rounded top corners, and
    // before a footer it ends above the band.
    const headed = frameRoot("Headed frame").getBoundingClientRect();
    const may = textNamed("May").getBoundingClientRect();
    const header = textNamed("Usage").parentElement?.getBoundingClientRect();
    const footer = textNamed("Exported").getBoundingClientRect();
    expect(may.top).toBe(header?.bottom);
    expect(may.bottom).toBe(footer.top);
    expect(may.left).toBe(headed.left);
    expect(cornerRadius(textNamed("May"))).toBe(FLUSH_ITEM_CORNER);

    // A collapsible section without a header that starts the Frame starts it as a direct panel
    // would: the panel's top edge lies on the root's, and the section's clip lets its top border
    // overhang the section, so a point on that border still hits the panel.
    const sectioned = frameRoot("Sectioned frame").getBoundingClientRect();
    const june = textNamed("June");
    const juneBox = june.getBoundingClientRect();
    expect(juneBox.top).toBe(sectioned.top);
    expect(juneBox.left).toBe(sectioned.left);
    const onTopBorder = document.elementFromPoint(juneBox.left + juneBox.width / 2, sectioned.top + 0.5);
    expect(onTopBorder !== null && june.contains(onTopBorder)).toBe(true);
  });

  it("keeps a flush Frame's edges when the Frame sits in a Collapsible between siblings", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <p>Before the section</p>
        <Collapsible.Root defaultOpen>
          <Frame.Root layout="flush" role="group" aria-label="Nested frame">
            <Frame.Panel>Nested first</Frame.Panel>
            <Frame.Panel>Nested last</Frame.Panel>
          </Frame.Root>
        </Collapsible.Root>
        <p>After the section</p>
      </ThemeScope>
    );
    // Siblings outside the Frame have no say in its edges: its first panel starts on the root's top
    // edge and its last panel ends on the root's bottom edge, as in any flush Frame.
    const root = roleNamed("group", "Nested frame").getBoundingClientRect();
    expect(textNamed("Nested first").getBoundingClientRect().top).toBe(root.top);
    expect(textNamed("Nested last").getBoundingClientRect().bottom).toBe(root.bottom);
  });

  it("joins panels across a headerless collapsible section as it joins sibling panels, in every layout", () => {
    // Each Frame pairs panels across a section boundary: a panel then a section, a section then a
    // panel, and two sections. The gutter layout keeps 4px between the pair; the stacked and flush
    // layouts fuse it, squaring the corners that meet and drawing one border between them.
    const section = (name: string): ReactElement => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Content>
          <Frame.Panel>{name}</Frame.Panel>
        </Collapsible.Content>
      </Collapsible.Root>
    );
    const pairs = (layout: FrameLayout): ReactElement => (
      <>
        <Frame.Root layout={layout}>
          <Frame.Panel>{`${layout} panel then section, upper`}</Frame.Panel>
          {section(`${layout} panel then section, lower`)}
        </Frame.Root>
        <Frame.Root layout={layout}>
          {section(`${layout} section then panel, upper`)}
          <Frame.Panel>{`${layout} section then panel, lower`}</Frame.Panel>
        </Frame.Root>
        <Frame.Root layout={layout}>
          {section(`${layout} section then section, upper`)}
          {section(`${layout} section then section, lower`)}
        </Frame.Root>
      </>
    );
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        {pairs("gutter")}
        {pairs("stacked")}
        {pairs("flush")}
      </ThemeScope>
    );
    const ITEM_CORNER = { gutter: PADDED_ITEM_CORNER, stacked: PADDED_ITEM_CORNER, flush: FLUSH_ITEM_CORNER };
    for (const layout of ["gutter", "stacked", "flush"] as const) {
      for (const pair of ["panel then section", "section then panel", "section then section"]) {
        const label = `${layout} ${pair}`;
        const upper = textNamed(`${label}, upper`);
        const lower = textNamed(`${label}, lower`);
        const upperStyle = getComputedStyle(upper);
        const lowerStyle = getComputedStyle(lower);
        const gap = lower.getBoundingClientRect().top - upper.getBoundingClientRect().bottom;
        if (layout === "gutter") {
          expect(gap, label).toBe(4);
          expect(px(upperStyle.borderBottomLeftRadius), label).toBe(ITEM_CORNER[layout]);
          expect(cornerRadius(lower), label).toBe(ITEM_CORNER[layout]);
          expect(lowerStyle.borderTopWidth, label).toBe("1px");
        } else {
          expect(gap, label).toBe(0);
          expect(px(upperStyle.borderBottomLeftRadius), label).toBe(0);
          expect(px(upperStyle.borderBottomRightRadius), label).toBe(0);
          expect(cornerRadius(lower), label).toBe(0);
          expect(px(lowerStyle.borderTopRightRadius), label).toBe(0);
          expect(lowerStyle.borderTopWidth, label).toBe("0px");
          // The upper panel's outer ends keep the item corner.
          expect(cornerRadius(upper), label).toBe(ITEM_CORNER[layout]);
          expect(px(lowerStyle.borderBottomLeftRadius), label).toBe(ITEM_CORNER[layout]);
        }
      }
    }
  });

  it("leaves a panel unjoined before a closed section that stays mounted", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <Frame.Root layout="stacked">
          <Frame.Panel>Before the closed section</Frame.Panel>
          <Collapsible.Root>
            <Collapsible.Content keepMounted>
              <Frame.Panel>Closed panel</Frame.Panel>
            </Collapsible.Content>
          </Collapsible.Root>
        </Frame.Root>
      </ThemeScope>
    );
    // The closed section shows nothing, so the panel before it ends the Frame's visible run of
    // panels and keeps its rounded bottom corners.
    const before = getComputedStyle(textNamed("Before the closed section"));
    expect(px(before.borderBottomLeftRadius)).toBe(PADDED_ITEM_CORNER);
    expect(px(before.borderBottomRightRadius)).toBe(PADDED_ITEM_CORNER);
  });

  it("frames a Table that is the root's child, flush to its edges", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <section aria-label="Table frame">
          <Frame.Root layout="flush">
            <Table.Root aria-label="Readings">
              <Table.Body>
                <Table.Row>
                  <Table.Cell>March</Table.Cell>
                  <Table.Cell>1 240 kWh</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Frame.Root>
        </section>
      </ThemeScope>
    );
    const root = frameRoot("Table frame").getBoundingClientRect();
    const table = roleNamed("table", "Readings");
    const container = table.parentElement;
    const body = table.querySelector("tbody");
    if (container === null || body === null) {
      throw new Error("expected a container and a body around the rows");
    }
    expect(container.getBoundingClientRect().left).toBe(root.left);
    expect(container.getBoundingClientRect().right).toBe(root.right);
    expect(cornerRadius(body)).toBe(FLUSH_ITEM_CORNER);
    expect(getComputedStyle(textNamed("March")).borderLeftWidth).toBe("1px");
  });

  it("renders a panel's only Table as a plain table that runs to the panel's edges and clips to its corners", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <Frame.Root>
          <Frame.Panel>
            <Table.Root aria-label="Meter status">
              <Table.Body>
                <Table.Row>
                  <Table.Head scope="row">Status</Table.Head>
                  <Table.Cell>Reading</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Frame.Panel>
          <Frame.Panel>
            <VerticalTable.Body tableProps={{ "aria-label": "Meter facts" }}>
              <VerticalTable.Row>
                <VerticalTable.Key render={<th scope="row" />}>Meter type</VerticalTable.Key>
                <VerticalTable.Value>Smart meter</VerticalTable.Value>
              </VerticalTable.Row>
            </VerticalTable.Body>
          </Frame.Panel>
          <Frame.Panel>
            <p>Readings</p>
            <Table.Root aria-label="Padded readings">
              <Table.Body>
                <Table.Row>
                  <Table.Cell>March</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Frame.Panel>
        </Frame.Root>
      </ThemeScope>
    );
    const table = roleNamed("table", "Meter status");
    const container = table.parentElement;
    const panel = container?.parentElement;
    const body = table.querySelector("tbody");
    if (container == null || panel == null || body === null) {
      throw new Error("expected a panel, a container and a body around the rows");
    }
    // A plain table: no framed cell borders or body corner.
    const cell = getComputedStyle(textNamed("Reading"));
    expect(cell.borderTopWidth).toBe("0px");
    expect(cell.borderRightWidth).toBe("0px");
    expect(cornerRadius(body)).toBe(0);
    expect(roleNamed("rowheader", "Status").tagName).toBe("TH");
    // The panel drops its padding, and the container fills its padding box and clips to its
    // corner, the panel's corner less the panel's 1px border.
    expect(getComputedStyle(panel).paddingTop).toBe("0px");
    expect(cornerRadius(panel)).toBe(PADDED_ITEM_CORNER);
    expect(cornerRadius(container)).toBe(PADDED_ITEM_CORNER - 1);
    expect(getComputedStyle(container).overflowY).not.toBe("visible");
    expect(container.getBoundingClientRect().left).toBe(panel.getBoundingClientRect().left + 1);
    expect(container.getBoundingClientRect().top).toBe(panel.getBoundingClientRect().top + 1);

    // A VerticalTable.Body takes the panel's border and corner in place of its own.
    const facts = roleNamed("table", "Meter facts").parentElement?.parentElement;
    if (facts == null) {
      throw new Error("expected the vertical table's box");
    }
    expect(getComputedStyle(facts).borderTopWidth).toBe("0px");
    expect(cornerRadius(facts)).toBe(PADDED_ITEM_CORNER - 1);
    expect(roleNamed("rowheader", "Meter type").tagName).toBe("TH");

    // A panel that holds more than the table keeps its padding: 16px, the dense large tier.
    const padded = roleNamed("table", "Padded readings").parentElement?.parentElement;
    if (padded == null) {
      throw new Error("expected the padded panel");
    }
    expect(getComputedStyle(padded).paddingTop).toBe("16px");
  });

  it("drops a panel's padding only for a Table element that is its only content", () => {
    // A function call, not a component: the panel receives the Table.Root element itself.
    const readings = (label: string) => (
      <Table.Root aria-label={label}>
        <Table.Body>
          <Table.Row>
            <Table.Cell>March</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    );
    function CaptionedReadings() {
      return (
        <>
          Meter readings
          {readings("Captioned by a component")}
        </>
      );
    }
    function OwnReadings() {
      return readings("Wrapped in a component");
    }
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <Frame.Root>
          <Frame.Panel role="group" aria-label="Text panel">
            Meter readings
            {readings("Captioned by text")}
          </Frame.Panel>
          <Frame.Panel role="group" aria-label="Number panel">
            <>
              {2026}
              <VerticalTable.Body tableProps={{ "aria-label": "Captioned by a number" }}>
                <VerticalTable.Row>
                  <VerticalTable.Key render={<th scope="row" />}>Year</VerticalTable.Key>
                  <VerticalTable.Value>Readings</VerticalTable.Value>
                </VerticalTable.Row>
              </VerticalTable.Body>
            </>
          </Frame.Panel>
          <Frame.Panel role="group" aria-label="Component text panel">
            <CaptionedReadings />
          </Frame.Panel>
          <Frame.Panel role="group" aria-label="Component table panel">
            <OwnReadings />
          </Frame.Panel>
          <Frame.Panel role="group" aria-label="Blank text panel">
            {" "}
            <>{readings("Beside blank text")}</>
          </Frame.Panel>
        </Frame.Root>
      </ThemeScope>
    );
    // Text beside the table, written directly, through a Fragment or by a component child, keeps
    // the large tier's 16px dense padding, and so does a component that renders only a table. The
    // table keeps its own square box and, for a VerticalTable.Body, its own 1px border.
    for (const label of ["Text panel", "Number panel", "Component text panel", "Component table panel"]) {
      const panel = roleNamed("group", label);
      expect(getComputedStyle(panel).paddingTop, label).toBe("16px");
      expect(getComputedStyle(panel).paddingLeft, label).toBe("16px");
    }
    const container = roleNamed("table", "Captioned by text").parentElement;
    if (container === null) {
      throw new Error("expected the table's container");
    }
    expect(cornerRadius(container)).toBe(0);
    const facts = roleNamed("table", "Captioned by a number").parentElement?.parentElement;
    if (facts == null) {
      throw new Error("expected the vertical table's box");
    }
    expect(getComputedStyle(facts).borderTopWidth).toBe("1px");
    // Blank text and a Fragment are no content of their own: the Table element is the panel's only
    // content, so the panel drops its padding.
    expect(getComputedStyle(roleNamed("group", "Blank text panel")).paddingTop).toBe("0px");
  });

  it("squares a padless table's corners where stacked and flush panels fuse", () => {
    function Facts({ label }: { label: string }) {
      return (
        <Frame.Panel>
          <VerticalTable.Body tableProps={{ "aria-label": label }}>
            <VerticalTable.Row>
              <VerticalTable.Key render={<th scope="row" />}>{`${label} key`}</VerticalTable.Key>
              <VerticalTable.Value>Value</VerticalTable.Value>
            </VerticalTable.Row>
          </VerticalTable.Body>
        </Frame.Panel>
      );
    }
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <Frame.Root layout="stacked">
          <Facts label="Stacked upper" />
          <Facts label="Stacked lower" />
        </Frame.Root>
        <Frame.Root layout="flush">
          <Facts label="Flush upper" />
          <Facts label="Flush lower" />
        </Frame.Root>
      </ThemeScope>
    );
    // The table's box sits inside its panel's 1px border, so its outer corners round 1px less than
    // the panel's: the item corner when padded and `rounded-xl` when flush. The corners at the
    // seam are square, as the panels' own are.
    const corners = (label: string) => {
      const box = roleNamed("table", label).parentElement?.parentElement;
      if (box == null) {
        throw new Error(`expected the box around ${label}`);
      }
      const style = getComputedStyle(box);
      return {
        top: [px(style.borderTopLeftRadius), px(style.borderTopRightRadius)],
        bottom: [px(style.borderBottomLeftRadius), px(style.borderBottomRightRadius)],
      };
    };
    for (const [layout, outer] of [
      ["Stacked", PADDED_ITEM_CORNER - 1],
      ["Flush", FLUSH_ITEM_CORNER - 1],
    ] as const) {
      expect(corners(`${layout} upper`), `${layout} upper`).toEqual({ top: [outer, outer], bottom: [0, 0] });
      expect(corners(`${layout} lower`), `${layout} lower`).toEqual({ top: [0, 0], bottom: [outer, outer] });
    }
    // The muted key cell fills its row to the seam: nothing of the panel shows between the two
    // key columns, so the lower key starts where the upper one ends.
    const upperKey = roleNamed("rowheader", "Stacked upper key").getBoundingClientRect();
    const lowerKey = roleNamed("rowheader", "Stacked lower key").getBoundingClientRect();
    expect(lowerKey.top - upperKey.bottom).toBe(1);
  });

  it("renders a Table in a panel inside a framed cell as a plain table", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <Frame.Root>
          <Table.Root aria-label="Outer readings">
            <Table.Body>
              <Table.Row>
                <Table.Cell>
                  <Frame.Panel>
                    <Table.Root aria-label="Inner readings">
                      <Table.Body>
                        <Table.Row>
                          <Table.Cell>Inner cell</Table.Cell>
                        </Table.Row>
                      </Table.Body>
                    </Table.Root>
                  </Frame.Panel>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </Frame.Root>
      </ThemeScope>
    );
    const outer = roleNamed("table", "Outer readings");
    const outerBody = outer.querySelector("tbody");
    const outerCell = outer.querySelector("td");
    const inner = roleNamed("table", "Inner readings");
    const innerBody = inner.querySelector("tbody");
    const innerCell = textNamed("Inner cell");
    if (outerBody === null || outerCell === null || innerBody === null) {
      throw new Error("expected both tables' bodies and cells");
    }
    // The outer table is the Frame's item: framed cell borders and the relayed corner.
    expect(getComputedStyle(outerCell).borderTopWidth).toBe("1px");
    expect(cornerRadius(outerBody)).toBe(PADDED_ITEM_CORNER);
    // The inner table sits in a panel in a framed cell: no framed borders, fill or corners.
    expect(getComputedStyle(innerCell).borderTopWidth).toBe("0px");
    expect(getComputedStyle(innerCell).borderLeftWidth).toBe("0px");
    expect(getComputedStyle(innerCell).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(cornerRadius(innerBody)).toBe(0);
    expect(getComputedStyle(innerBody, "::before").display).toBe("none");
  });

  it("keeps the corner and flush edges of a panel in a Collapsible", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <section aria-label="Padded frame">
          <Frame.Root>
            <Collapsible.Root defaultOpen>
              <Frame.Header>
                <Collapsible.Trigger>Start</Collapsible.Trigger>
              </Frame.Header>
              <Collapsible.Content>
                <Frame.Panel>Padded panel</Frame.Panel>
              </Collapsible.Content>
            </Collapsible.Root>
          </Frame.Root>
        </section>
        <section aria-label="Flush frame">
          <Frame.Root layout="flush">
            <Collapsible.Root defaultOpen>
              <Frame.Header>
                <Collapsible.Trigger>Finish</Collapsible.Trigger>
              </Frame.Header>
              <Collapsible.Content>
                <Frame.Panel>Flush panel</Frame.Panel>
              </Collapsible.Content>
            </Collapsible.Root>
          </Frame.Root>
        </section>
      </ThemeScope>
    );
    expect(cornerRadius(textNamed("Padded panel"))).toBe(PADDED_ITEM_CORNER);

    const flush = frameRoot("Flush frame").getBoundingClientRect();
    const panel = textNamed("Flush panel");
    expect(cornerRadius(panel)).toBe(FLUSH_ITEM_CORNER);
    expect(panel.getBoundingClientRect().left).toBe(flush.left);
    expect(panel.getBoundingClientRect().right).toBe(flush.right);
    expect(panel.getBoundingClientRect().bottom).toBe(flush.bottom);
  });

  it("lets a header's Collapsible trigger take the whole band and toggle the panel", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Frame.Root>
          <Collapsible.Root defaultOpen>
            <Frame.Header>
              <Collapsible.Trigger>
                Start
                <CaretDown />
              </Collapsible.Trigger>
            </Frame.Header>
            <Collapsible.Content>
              <Frame.Panel>Initialise the meter reading run.</Frame.Panel>
            </Collapsible.Content>
          </Collapsible.Root>
        </Frame.Root>
      </>
    );
    const trigger = roleNamed("button", "Start");
    const header = trigger.parentElement;
    if (header === null) {
      throw new Error("expected the header around the trigger");
    }
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    for (const density of DENSITIES) {
      stampDensity(density);
      const band = header.getBoundingClientRect();
      const box = trigger.getBoundingClientRect();
      expect(box, density).toEqual(band);
      expect(box.height, `${density} target`).toBeGreaterThanOrEqual(24);
    }

    await userEvent.click(roleNamed("button", "Before"));
    await userEvent.keyboard("{Tab}");
    expect(trigger.matches(":focus-visible")).toBe(true);
    // One 2px ring in --ring, drawn inside the band, so the panel below cannot cover it.
    settleTransitions(trigger);
    expect(ringLayers(trigger)).toEqual([
      { spread: "2px", color: cssVarColor(trigger, "--ring"), inset: true },
    ]);

    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(page.getByText("Initialise the meter reading run.").query()).toBeNull();
    });
  });

  it("turns the trigger's caret half a turn while the panel is open, and drops the turn's transition under reduced motion", async () => {
    renderThemed(
      <Frame.Root>
        <Collapsible.Root>
          <Frame.Header>
            <Collapsible.Trigger>
              Start
              <CaretDown data-testid="caret" />
            </Collapsible.Trigger>
          </Frame.Header>
          <Collapsible.Content>
            <Frame.Panel>Run details</Frame.Panel>
          </Collapsible.Content>
        </Collapsible.Root>
      </Frame.Root>
    );
    const caret = page.getByTestId("caret").element();
    expect(getComputedStyle(caret).rotate).toBe("none");
    expect(getComputedStyle(caret).transitionProperty).toContain("rotate");

    await userEvent.click(roleNamed("button", "Start"));
    await vi.waitFor(() => {
      expect(getComputedStyle(caret).rotate).toBe("180deg");
    });

    await emulateReducedMotion("reduce");
    expect(getComputedStyle(caret).transitionProperty).not.toContain("rotate");
  });

  it("treats a panel in a plain wrapper as a plain panel in every layout", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <section aria-label="Wrapped flush frame">
          <Frame.Root layout="flush">
            <div>
              <Frame.Panel>Wrapped upper</Frame.Panel>
              <Frame.Panel>Wrapped lower</Frame.Panel>
            </div>
          </Frame.Root>
        </section>
        <Frame.Root layout="stacked">
          <div>
            <Frame.Panel>Stacked wrapped upper</Frame.Panel>
            <Frame.Panel>Stacked wrapped lower</Frame.Panel>
          </div>
        </Frame.Root>
        <Frame.Root>
          <div>
            <Frame.Panel>Gutter wrapped upper</Frame.Panel>
            <Frame.Panel>Gutter wrapped lower</Frame.Panel>
          </div>
        </Frame.Root>
      </ThemeScope>
    );
    // A wrapper that is no Collapsible hides its panels from the Frame: each keeps `rounded-xl` on
    // all four corners and its own top border, and a flush Frame does not pull it over its border,
    // so it starts 1px inside the root.
    const root = frameRoot("Wrapped flush frame").getBoundingClientRect();
    expect(textNamed("Wrapped upper").getBoundingClientRect().left).toBe(root.left + 1);
    expect(textNamed("Wrapped upper").getBoundingClientRect().top).toBe(root.top + 1);
    for (const name of [
      "Wrapped upper",
      "Wrapped lower",
      "Stacked wrapped upper",
      "Stacked wrapped lower",
      "Gutter wrapped upper",
      "Gutter wrapped lower",
    ]) {
      const style = getComputedStyle(textNamed(name));
      expect(px(style.borderTopLeftRadius), name).toBe(RADIUS_XL.tkas);
      expect(px(style.borderBottomLeftRadius), name).toBe(RADIUS_XL.tkas);
      expect(style.borderTopWidth, name).toBe("1px");
      expect(style.marginTop, name).toBe("0px");
    }
  });

  it("paints a collapsible panel's shadow past the clip of its Collapsible.Content", () => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        {(["gutter", "flush"] as const).map((layout) => (
          <Frame.Root key={layout} layout={layout}>
            <Collapsible.Root defaultOpen>
              <Frame.Header>
                <Collapsible.Trigger>{`Open ${layout}`}</Collapsible.Trigger>
              </Frame.Header>
              <Collapsible.Content>
                <Frame.Panel>{`Shadowed ${layout}`}</Frame.Panel>
              </Collapsible.Content>
            </Collapsible.Root>
          </Frame.Root>
        ))}
      </ThemeScope>
    );
    for (const layout of ["gutter", "flush"] as const) {
      const panel = textNamed(`Shadowed ${layout}`);
      const content = panel.parentElement;
      if (content === null) {
        throw new Error("expected the content around the panel");
      }
      // The shadow's reach on each side, from the panel's computed box-shadow: blur and spread
      // grow every side, and the offset moves the shadow towards one.
      const layers = shadowLayers(getComputedStyle(panel).boxShadow).flatMap((layer) => {
        const lengths = /(?:^|\s)inset(?:\s|$)/u.test(layer) ? undefined : shadowLayerLengths(layer);
        return lengths === undefined ? [] : [lengths];
      });
      expect(layers.length, layout).toBeGreaterThan(0);
      const reach = {
        left: Math.max(...layers.map(({ x, blur, spread }) => blur + spread - x)),
        right: Math.max(...layers.map(({ x, blur, spread }) => blur + spread + x)),
        bottom: Math.max(...layers.map(({ y, blur, spread }) => blur + spread + y)),
      };
      // The painted shadow must lie inside the content's clip, read from its clip-path insets.
      const insets = /^inset\((.*)\)$/u.exec(getComputedStyle(content).clipPath)?.[1]?.split(/\s+/u).map(px);
      if (insets === undefined) {
        throw new Error(`expected an inset clip-path on the ${layout} content`);
      }
      const [top = 0, right = top, bottom = top, left = right] = insets;
      const clip = content.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      expect(getComputedStyle(content).overflowY, layout).toBe("visible");
      expect(clip.left + left, `${layout} left`).toBeLessThanOrEqual(box.left - reach.left);
      expect(clip.right - right, `${layout} right`).toBeGreaterThanOrEqual(box.right + reach.right);
      expect(clip.bottom - bottom, `${layout} bottom`).toBeGreaterThanOrEqual(box.bottom + reach.bottom);
    }
  });

  it("clips a closing collapsible panel to its animating height", async () => {
    await emulateReducedMotion("no-preference");
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <Frame.Root>
          <Collapsible.Root defaultOpen>
            <Frame.Header>
              <Collapsible.Trigger>Readings</Collapsible.Trigger>
            </Frame.Header>
            <Collapsible.Content>
              <Frame.Panel>
                <p>Line one</p>
                <p>Line two</p>
                <p>Line three</p>
                <p>Line four</p>
              </Frame.Panel>
            </Collapsible.Content>
          </Collapsible.Root>
        </Frame.Root>
      </ThemeScope>
    );
    const panel = textNamed("Line one").parentElement;
    const content = panel?.parentElement;
    if (panel == null || content == null) {
      throw new Error("expected the panel and its content");
    }
    const full = panel.getBoundingClientRect().height;
    await userEvent.click(roleNamed("button", "Readings"));
    // Sample frames until the content is mid-glide: shorter than its panel by more than the clip's
    // 4px bleed and a probe's margin, and still open.
    let midGlide = false;
    for (let frame = 0; frame < 30 && !midGlide; frame += 1) {
      await nextFrames(1);
      const height = content.getBoundingClientRect().height;
      midGlide = height > 8 && height < full - 16;
    }
    expect(midGlide, "the content never reached the middle of its height transition").toBe(true);
    const clip = content.getBoundingClientRect();
    const x = clip.left + clip.width / 2;
    // Inside the animating box the panel still takes the pointer; well below it, past the clip's
    // bleed, the clipped panel does not.
    const inside = document.elementFromPoint(x, clip.bottom - 4);
    const below = document.elementFromPoint(x, clip.bottom + 10);
    expect(inside !== null && panel.contains(inside)).toBe(true);
    expect(below !== null && panel.contains(below)).toBe(false);
  });

  it.each([
    ["ltr", "gutter"],
    ["ltr", "stacked"],
    ["ltr", "flush"],
    ["rtl", "gutter"],
    ["rtl", "stacked"],
    ["rtl", "flush"],
  ] as const)("starts and ends every text column on one inset (%s, %s)", (dir, layout) => {
    renderThemed(
      <ThemeScope theme={tkasCompany}>
        <div dir={dir} style={{ width: 560 }}>
          <Frame.Root layout={layout}>
            <Frame.Header>
              <Frame.Title>Invoices</Frame.Title>
              <Frame.Description>Last 30 days</Frame.Description>
            </Frame.Header>
            <Table.Root aria-label="Framed invoices">
              <Table.Caption>Invoices for the last 30 days</Table.Caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Invoice</Table.Head>
                  <Table.Head style={{ textAlign: "end" }}>Amount</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                <Table.Row>
                  <Table.Cell>#1042</Table.Cell>
                  <Table.Cell style={{ textAlign: "end" }}>NOK 1 240</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
            <Frame.Panel>
              <VerticalTable.Body tableProps={{ "aria-label": "Meter facts" }}>
                <VerticalTable.Row>
                  <VerticalTable.Key render={<th scope="row" />}>Meter type</VerticalTable.Key>
                  <VerticalTable.Value style={{ textAlign: "end" }}>Smart meter</VerticalTable.Value>
                </VerticalTable.Row>
              </VerticalTable.Body>
            </Frame.Panel>
            <Frame.Panel>
              <p style={{ margin: 0 }}>Reminders go out after the due date.</p>
              <p style={{ margin: 0, textAlign: "end" }}>Seven days</p>
            </Frame.Panel>
            <Collapsible.Root defaultOpen>
              <Frame.Header>
                <Collapsible.Trigger>Collect readings</Collapsible.Trigger>
              </Frame.Header>
              <Collapsible.Content>
                <Frame.Panel>Fetch the hourly readings.</Frame.Panel>
              </Collapsible.Content>
            </Collapsible.Root>
            <Frame.Footer>
              <p style={{ margin: 0 }}>Export the period</p>
              <p style={{ margin: 0, textAlign: "end" }}>CSV</p>
            </Frame.Footer>
          </Frame.Root>
        </div>
      </ThemeScope>
    );
    // A text's first and last glyph edges, from the layout of its own text node.
    const textEdges = (text: string) => {
      const owner = textNamed(text);
      const node = [...owner.childNodes].find((child) => child.textContent?.includes(text) === true);
      if (node === undefined) {
        throw new Error(`expected a text node for ${text}`);
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()];
      return {
        left: Math.min(...rects.map((rect) => rect.left)),
        right: Math.max(...rects.map((rect) => rect.right)),
      };
    };
    const starts = [
      "Invoices",
      "Last 30 days",
      "Invoices for the last 30 days",
      "Invoice",
      "#1042",
      "Meter type",
      "Reminders go out after the due date.",
      "Collect readings",
      "Fetch the hourly readings.",
      "Export the period",
    ];
    const ends = ["Amount", "NOK 1 240", "Smart meter", "Seven days", "CSV"];
    // In a left-to-right Frame text starts on the left; in a right-to-left one on the right.
    const start = (text: string) => (dir === "ltr" ? textEdges(text).left : textEdges(text).right);
    const end = (text: string) => (dir === "ltr" ? textEdges(text).right : textEdges(text).left);
    for (const density of DENSITIES) {
      stampDensity(density);
      const reference = start("Reminders go out after the due date.");
      for (const text of starts) {
        expect(Math.abs(start(text) - reference), `${density} start of ${text}`).toBeLessThanOrEqual(0.5);
      }
      const referenceEnd = end("Seven days");
      for (const text of ends) {
        expect(Math.abs(end(text) - referenceEnd), `${density} end of ${text}`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("keeps the panel hairline overlay non-interactive", () => {
    renderThemed(
      <Frame.Root>
        <Frame.Panel>March</Frame.Panel>
      </Frame.Root>
    );
    const overlay = getComputedStyle(textNamed("March"), "::before");
    expect(overlay.pointerEvents).toBe("none");
    expect(overlay.position).toBe("absolute");
  });
});
