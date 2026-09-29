import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Frame } from "./frame";

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
