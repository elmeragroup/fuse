import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Empty } from "./empty";
import { emptyMediaVariants, emptyVariants } from "./empty-variants";

describe("emptyVariants", () => {
  it("keeps the anatomy layout classes without a control-box size axis", () => {
    const resolved = emptyVariants();
    expect(resolved).toContain("flex");
    expect(resolved).toContain("min-w-0");
    expect(resolved).toContain("flex-1");
    expect(resolved).toContain("flex-col");
    expect(resolved).toContain("items-center");
    expect(resolved).toContain("justify-center");
    expect(resolved).toContain("gap-6");
    expect(resolved).toContain("rounded-lg");
    expect(resolved).toContain("p-(--surface-pad-lg)");
    expect(resolved).toContain("text-center");
    expect(resolved).toContain("text-balance");
    expect(resolved).toContain("md:p-[calc(2*var(--surface-pad-lg))]");
    expect(resolved).not.toContain("--control-");
    expect(resolved).not.toContain("data-density");
  });

  it("carries no destructive, raw palette, or dark classes", () => {
    const resolved = [
      emptyVariants(),
      emptyVariants({ variant: "outline" }),
      emptyVariants({ variant: "outline-dashed" }),
    ].join(" ");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toContain("destructive");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
  });
});

describe("emptyMediaVariants", () => {
  it("defaults to transparent media and boxes the icon variant", () => {
    expect(emptyMediaVariants()).toContain("bg-transparent");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("size-10");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("rounded-lg");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("bg-muted");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("text-foreground");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("[&_svg:not([class*='size-'])]:size-6");
  });

  it("keeps the media base classes on every variant", () => {
    for (const variant of ["default", "icon"] as const) {
      const resolved = emptyMediaVariants({ variant });
      expect(resolved, variant).toContain("mb-2");
      expect(resolved, variant).toContain("flex");
      expect(resolved, variant).toContain("shrink-0");
      expect(resolved, variant).toContain("items-center");
      expect(resolved, variant).toContain("justify-center");
      expect(resolved, variant).toContain("[&_svg]:pointer-events-none");
      expect(resolved, variant).toContain("[&_svg]:shrink-0");
      expect(resolved, variant).not.toContain("--control-");
    }
  });
});

describe("Empty server boundary", () => {
  it("imports and renders the namespace without a use client directive", () => {
    const html = renderToStaticMarkup(
      createElement(
        Empty.Root,
        null,
        createElement(
          Empty.Header,
          null,
          createElement(Empty.Media, { variant: "icon" }, "icon"),
          createElement(Empty.Title, null, "No orders yet"),
          createElement(Empty.Description, null, "Orders you create will show up here.")
        ),
        createElement(Empty.Content, null, "Create order")
      )
    );
    expect(html).toContain("No orders yet");
    expect(html).toContain("Orders you create will show up here.");
    expect(html).toContain("Create order");
    expect(html).toContain('data-slot="empty-media"');
    expect(html).not.toContain('data-slot="empty-icon"');
    expect(html).toMatch(/<p[^>]*data-slot="empty-description"/);
    expect(html).toContain("[&amp;&gt;a]:underline");
    expect(html).toContain("[&amp;&gt;a]:underline-offset-4");
    expect(html).toContain("[&amp;&gt;a:hover]:text-primary");
  });
});
