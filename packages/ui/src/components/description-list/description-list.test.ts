import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { DescriptionList } from "./description-list";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "description-list.tsx"), "utf8");
const headingSource = readFileSync(join(here, "description-list-heading.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "description-list.ts"), "utf8");

const CONTENT_CLASSES =
  "text-base/6 sm:grid-cols-[min(50%,calc(var(--spacing)*80))_auto] sm:text-sm/6 grid grid-cols-1";
const TERM_CLASSES = "col-start-1 border-t py-2 pr-2 text-muted-foreground first-of-type:border-none";
const DETAILS_CLASSES = "sm:border-t py-2 text-foreground first-of-type:border-none";
const HEADING_CLASSES = "text-lg leading-snug font-medium font-heading text-inherit";

const SLOTS = [
  "description-list",
  "description-list-heading",
  "description-list-content",
  "description-list-term",
  "description-list-details",
] as const;

function markup(): string {
  return renderToStaticMarkup(
    createElement(
      DescriptionList.Root,
      null,
      createElement(DescriptionList.Heading, null, "Customer"),
      createElement(
        DescriptionList.Content,
        null,
        createElement(DescriptionList.Term, null, "Name"),
        createElement(DescriptionList.Details, null, "Kari Nordmann"),
        createElement(DescriptionList.Term, null, "Meter point"),
        createElement(DescriptionList.Details, null, "7070575000")
      )
    )
  );
}

describe("description-list source contract", () => {
  it("stays a server compound that emits data-slot before the props spread", () => {
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("react-aria");
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toContain("as DescriptionListRoot");
    expect(source).not.toContain('from "../heading/heading"');
    expect(source).not.toContain("descriptionListVariants");
    expect(source).toContain('displayName = "DescriptionList.Root"');
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("descriptionListVariants");
    expect(facade).not.toContain("as DescriptionListRoot");
    expect(facade).not.toContain("export { DescriptionListHeading");
    for (const slot of [
      "description-list",
      "description-list-content",
      "description-list-term",
      "description-list-details",
    ] as const) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });

  it("keeps Heading as a client useRender island with the ref's level-2 classes", () => {
    expect(headingSource.trimStart().startsWith('"use client"')).toBe(true);
    expect(headingSource).toContain("useRender");
    expect(headingSource).toContain("mergeProps");
    expect(headingSource).toContain('"data-slot": "description-list-heading"');
    expect(headingSource).toContain(HEADING_CLASSES);
    expect(headingSource).not.toContain("react-aria");
    expect(headingSource).not.toContain("react-aria-components");
    expect(headingSource).not.toContain('from "../heading/heading"');
    expect(headingSource).not.toContain("headingVariants");
    expect(headingSource).toContain('displayName = "DescriptionList.Heading"');
  });

  it("keeps the class-free Root, column arithmetic, and Details cn-first spread-last", () => {
    expect(source).toContain(CONTENT_CLASSES);
    expect(source).toContain(TERM_CLASSES);
    expect(source).toContain(DETAILS_CLASSES);
    const detailsIndex = source.indexOf("function DescriptionListDetails");
    const detailsBlock = source.slice(detailsIndex);
    expect(detailsBlock.indexOf("className={cn(")).toBeLessThan(detailsBlock.indexOf("{...props}"));
  });
});

describe("DescriptionList server boundary", () => {
  it("imports and renders the namespace without a use client directive on the compound", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    const html = markup();
    expect(html).toContain("<div");
    expect(html).toContain("<h2");
    expect(html).toContain("<dl");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
    expect(html).toContain("Customer");
    expect(html).toContain("Kari Nordmann");
    expect(html).toContain("7070575000");
    for (const slot of SLOTS) {
      expect(html, slot).toContain(`data-slot="${slot}"`);
    }
  });
});

describe("DescriptionList structure", () => {
  it("renders a dl containing alternating dt/dd in DOM order", () => {
    const html = markup();
    const dlStart = html.indexOf("<dl");
    const dt1 = html.indexOf("<dt", dlStart);
    const dd1 = html.indexOf("<dd", dt1);
    const dt2 = html.indexOf("<dt", dd1);
    const dd2 = html.indexOf("<dd", dt2);
    expect(dt1).toBeGreaterThan(dlStart);
    expect(dd1).toBeGreaterThan(dt1);
    expect(dt2).toBeGreaterThan(dd1);
    expect(dd2).toBeGreaterThan(dt2);
    expect(html.indexOf("Name")).toBeLessThan(html.indexOf("Kari Nordmann"));
    expect(html.indexOf("Meter point")).toBeLessThan(html.indexOf("7070575000"));
  });

  it("passes Root attributes through and adds no classes of its own", () => {
    const html = renderToStaticMarkup(
      createElement(DescriptionList.Root, { id: "customer", "aria-label": "profile" }, "x")
    );
    expect(html).toContain('data-slot="description-list"');
    expect(html).toContain('id="customer"');
    expect(html).toContain('aria-label="profile"');
    expect(html).not.toMatch(/class=/);
  });

  it("lets a consumer className win over Details base classes through cn", () => {
    const merged = cn(DETAILS_CLASSES, "text-primary").split(/\s+/);
    expect(merged).toContain("text-primary");
    expect(merged).not.toContain("text-foreground");
    const html = renderToStaticMarkup(
      createElement(DescriptionList.Details, { className: "text-primary" }, "Kari Nordmann")
    );
    expect(html).toContain("text-primary");
    expect(html).not.toContain("text-foreground");
  });

  it("merges className on Content, Term, and Heading", () => {
    const content = renderToStaticMarkup(createElement(DescriptionList.Content, { className: "max-w-md" }));
    expect(content).toContain("max-w-md");
    expect(content).toContain("grid");
    const term = renderToStaticMarkup(
      createElement(DescriptionList.Term, { className: "font-medium" }, "Name")
    );
    expect(term).toContain("font-medium");
    expect(term).toContain("text-muted-foreground");
    const heading = renderToStaticMarkup(
      createElement(DescriptionList.Heading, { className: "mb-4" }, "Customer")
    );
    expect(heading).toContain("mb-4");
    expect(heading).toContain("font-heading");
  });

  it("paints from tokens without a dark variant or raw palette utility", () => {
    const html = markup();
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("text-foreground");
    expect(html).not.toContain("dark:");
    expect(html).not.toContain("destructive");
    expect(html).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(headingSource).not.toMatch(RAW_PALETTE_RE);
  });
});
