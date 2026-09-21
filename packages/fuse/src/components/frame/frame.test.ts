import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Frame } from "./frame";

const STACKED_CLASSES =
  "*:has-[+[data-slot=frame-panel]]:rounded-b-none *:has-[+[data-slot=frame-panel]]:before:hidden *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0";
const GUTTER_CLASSES = "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1";

function markup(stackedPanels?: boolean): string {
  return renderToStaticMarkup(
    createElement(
      Frame.Root,
      stackedPanels === undefined ? null : { stackedPanels },
      createElement(
        Frame.Header,
        null,
        createElement(Frame.Title, null, "Invoices"),
        createElement(Frame.Description, null, "Last 30 days")
      ),
      createElement(Frame.Panel, null, "March"),
      createElement(Frame.Panel, null, "April"),
      createElement(Frame.Footer, null, "Export")
    )
  );
}

describe("Frame structure", () => {
  it("renders children in order and emits each part's data-slot", () => {
    const html = markup();
    expect(html.indexOf("frame-panel-header")).toBeLessThan(html.indexOf('data-slot="frame-panel"'));
    expect(html.indexOf('data-slot="frame-panel"')).toBeLessThan(html.indexOf("frame-panel-footer"));
    expect(html).toContain('data-slot="frame"');
    expect(html).toContain('data-slot="frame-panel-title"');
    expect(html).toContain('data-slot="frame-panel-description"');
    expect(html).toContain("<header");
    expect(html).toContain("<footer");
    expect(html).toContain("Invoices");
    expect(html).toContain("Last 30 days");
  });

  it("swaps the sibling-adjacency class set when stackedPanels is true", () => {
    const gutter = markup(false);
    const stacked = markup(true);
    expect(gutter).not.toEqual(stacked);
    expect(gutter).toContain(GUTTER_CLASSES);
    expect(gutter).not.toContain("rounded-b-none");
    expect(stacked).toContain(STACKED_CLASSES);
    expect(stacked).not.toContain(GUTTER_CLASSES);
  });

  it("paints from tokens without a dark variant or raw palette utility", () => {
    const html = markup();
    expect(html).toContain("bg-muted/72");
    expect(html).toContain("bg-background");
    expect(html).toContain("text-muted-foreground");
    expect(html).not.toContain("dark:");
    expect(html).not.toContain("destructive");
    expect(html).not.toMatch(RAW_PALETTE_RE);
  });
});
