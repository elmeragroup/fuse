import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { focusRing } from "../../styles/utils";
import { Accordion } from "./accordion";
import { accordionVariants } from "./accordion-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "accordion.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "accordion-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "accordion.ts"), "utf8");
const focusSelf = focusRing({ target: "self" }).root();

const VARIANTS = ["default", "card", "infodropdown"] as const;
const RADII = ["none", "lg", "xl"] as const;

describe("accordionVariants", () => {
  it("defaults to variant=default and radius=none", () => {
    const slots = accordionVariants();
    const defaults = accordionVariants({ variant: "default", radius: "none" });
    expect(slots.item()).toBe(defaults.item());
    expect(slots.trigger()).toBe(defaults.trigger());
    expect(slots.item()).toContain("bg-muted");
    expect(slots.item()).toContain("rounded-sm");
    expect(slots.item()).toContain("p-4");
    expect(slots.item()).not.toContain("overflow-hidden");
  });

  it("maps each variant onto the spec slots without leaking the others", () => {
    const defaults = accordionVariants({ variant: "default" });
    expect(defaults.item()).toContain("bg-muted");
    expect(defaults.trigger()).toContain("transition-all");
    expect(defaults.item()).not.toContain("bg-card");
    expect(defaults.content()).not.toContain("pl-7");

    const card = accordionVariants({ variant: "card" });
    expect(card.base()).toContain("space-y-3");
    expect(card.item()).toContain("bg-card");
    expect(card.item()).toContain("text-foreground");
    expect(card.item()).toContain("rounded-lg");
    expect(card.item()).toContain("border");
    expect(card.content()).toContain("bg-card");
    expect(card.content()).toContain("text-foreground");
    expect(card.content()).toContain("rounded-lg");
    expect(card.icon()).toContain("text-foreground");
    expect(card.item()).not.toContain("bg-muted");
    expect(card.trigger()).not.toContain("justify-start");

    const info = accordionVariants({ variant: "infodropdown" });
    expect(info.base()).toContain("border-border");
    expect(info.base()).toContain("border-b");
    expect(info.trigger()).toContain("relative");
    expect(info.trigger()).toContain("justify-start");
    expect(info.trigger()).toContain("data-[panel-open]:pb-0");
    expect(info.icon()).toContain("absolute");
    expect(info.icon()).toContain("right-0");
    expect(info.content()).toContain("pl-7");
    expect(info.item()).not.toContain("bg-card");
  });

  it("applies radius only on the item slot", () => {
    const none = accordionVariants({ radius: "none" });
    expect(none.item()).not.toContain("overflow-hidden");
    expect(none.item()).not.toContain("rounded-lg");
    expect(none.item()).not.toContain("rounded-xl");

    const lg = accordionVariants({ radius: "lg" });
    expect(lg.item()).toContain("overflow-hidden");
    expect(lg.item()).toContain("rounded-lg");
    expect(lg.item()).not.toContain("rounded-xl");

    const xl = accordionVariants({ radius: "xl" });
    expect(xl.item()).toContain("overflow-hidden");
    expect(xl.item()).toContain("rounded-xl");
    expect(xl.item()).not.toContain("rounded-lg");
  });

  it("keeps the height transition, group chevron, and shared self focus ring", () => {
    const slots = accordionVariants();
    expect(slots.header()).toContain("flex");
    expect(slots.trigger()).toContain("group/accordion-trigger");
    expect(slots.trigger()).toContain("data-[panel-open]:pb-4");
    expect(slots.trigger()).not.toContain("data-[state=open]");
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(slots.trigger()).toContain(token);
    }
    expect(slots.icon()).toContain("group-data-[panel-open]/accordion-trigger:rotate-180");
    expect(slots.content()).toContain("h-0");
    expect(slots.content()).toContain("overflow-hidden");
    expect(slots.content()).toContain("transition-[height]");
    expect(slots.content()).toContain("motion-reduce:transition-none");
    expect(slots.content()).toContain("data-[open]:h-(--accordion-panel-height)");
    expect(slots.contentInner()).toContain("pt-1.5");
  });

  it("covers every public variant and radius without raw palette, dark, or density variants", () => {
    expect(VARIANTS).toHaveLength(3);
    expect(RADII).toHaveLength(3);
    for (const variant of VARIANTS) {
      const slots = accordionVariants({ variant });
      const resolved = [
        slots.base(),
        slots.item(),
        slots.header(),
        slots.trigger(),
        slots.icon(),
        slots.content(),
        slots.contentInner(),
      ].join(" ");
      expect(resolved.length).toBeGreaterThan(0);
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
      expect(resolved, variant).not.toMatch(/\b(?:dense|comfortable):/);
      expect(resolved, variant).not.toContain("bg-secondary-container");
      expect(resolved, variant).not.toContain("text-on-surface");
      expect(resolved, variant).not.toContain("bg-on-primary");
    }
    for (const radius of RADII) {
      expect(accordionVariants({ radius }).item().length).toBeGreaterThan(0);
    }
  });
});

describe("accordion source contract", () => {
  it("stays a client surface that emits data-slot before the props spread", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { Accordion } from "./components/accordion/accordion"');
    expect(facade).toContain('export { accordionVariants } from "./components/accordion/accordion-variants"');
    expect(source).toContain('displayName = "Accordion.Root"');
    expect(source).toContain('displayName = "Accordion.Item"');
    expect(source).toContain('displayName = "Accordion.Header"');
    expect(source).toContain('displayName = "Accordion.Trigger"');
    expect(source).toContain('displayName = "Accordion.Content"');
    for (const slot of [
      "accordion",
      "accordion-item",
      "accordion-header",
      "accordion-trigger",
      "accordion-content",
    ]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });

  it("reimplements the radix API shape on base-ui without radix props or keyframes", () => {
    const combined = `${source}\n${variantsSource}`;
    expect(source).toContain('from "@base-ui/react/accordion"');
    expect(source).toContain("AccordionPrimitive.Panel");
    expect(source).toContain("CaretDown");
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("contentInner({ className })");
    expect(combined).not.toContain("@radix-ui");
    expect(combined).not.toContain("type=");
    expect(combined).not.toContain("collapsible");
    expect(combined).not.toContain("data-[state=open]");
    expect(combined).not.toContain("animate-accordion");
    expect(combined).not.toContain("MaterialIcon");
    expect(combined).not.toContain("ExpandMore");
    expect(combined).not.toContain("react-aria");
    expect(variantsSource).toContain('focusRing({ target: "self" })');
    expect(variantsSource).toContain("group/accordion-trigger");
    expect(variantsSource).toContain("--accordion-panel-height");
    expect(variantsSource).toContain("motion-reduce:transition-none");
  });

  it("throws when Item, Header, Trigger, or Content render outside Root", () => {
    expect(() => renderToStaticMarkup(createElement(Accordion.Item, { value: "shipping" }))).toThrow(
      "useAccordion must be used within Accordion.Root"
    );
    expect(() => renderToStaticMarkup(createElement(Accordion.Header))).toThrow(
      "useAccordion must be used within Accordion.Root"
    );
    expect(() => renderToStaticMarkup(createElement(Accordion.Trigger, null, "Shipping"))).toThrow(
      "useAccordion must be used within Accordion.Root"
    );
    expect(() => renderToStaticMarkup(createElement(Accordion.Content, null, "Body"))).toThrow(
      "useAccordion must be used within Accordion.Root"
    );
  });
});
