import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { ringLayers, settleTransitions } from "../../../test/assert-invalid-ring";
import { cornerRadius } from "../../../test/inner-corner-specimens";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { TARGET_SIZE } from "../../../test/target-size";
import { tkasCompany } from "../../../test/theme-fixtures";
import {
  cssVarColor,
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
      expect(box.height, `${density} target`).toBeGreaterThanOrEqual(TARGET_SIZE);
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
});
