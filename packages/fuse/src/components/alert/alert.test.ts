import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Alert } from "./alert";

describe("Alert server boundary", () => {
  it("imports and renders the namespace without a use client directive", () => {
    const html = renderToStaticMarkup(
      createElement(
        Alert.Root,
        { variant: "warning" },
        createElement(Alert.Title, null, "Sync delayed"),
        createElement(Alert.Description, null, "Facility data is more than an hour old.")
      )
    );
    expect(html).toContain("Sync delayed");
    expect(html).toContain("Facility data is more than an hour old.");
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-slot="item"');
    expect(html).toContain('data-slot="item-media"');
    expect(html).toContain('data-slot="item-content"');
    expect(html).toContain('data-slot="item-title"');
    expect(html).toContain('data-slot="item-description"');
    expect(html).toContain('data-slot="alert-icon"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/<h3[^>]*data-slot="item-title"/);
    expect(html).toMatch(/<div[^>]*data-slot="item-description"/);
    expect(html).not.toContain('data-slot="item-actions"');
    expect(html).not.toContain("bg-destructive");
    expect(html).not.toContain("warning-accent");
    expect(html).not.toMatch(RAW_PALETTE_RE);
  });
});
