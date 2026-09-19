import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { panelHeightTransition } from "../../styles/panel-height";
import { focusRing } from "../../styles/utils";
import { Accordion } from "./accordion";
import { accordionVariants } from "./accordion-variants";

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

  it("maps each variant onto the public slots without leaking the others", () => {
    const defaults = accordionVariants({ variant: "default" });
    expect(defaults.item()).toContain("bg-muted");
    expect(defaults.trigger()).toContain("transition-[padding-bottom]");
    expect(defaults.trigger()).not.toContain("transition-all");
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

  it("keeps the shared panel-height transition, group chevron, and shared self focus ring", () => {
    const slots = accordionVariants();
    expect(slots.header()).toContain("flex");
    expect(slots.trigger()).toContain("group/accordion-trigger");
    expect(slots.trigger()).toContain("data-[panel-open]:pb-4");
    expect(slots.trigger()).not.toContain("data-[state=open]");
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(slots.trigger()).toContain(token);
    }
    expect(slots.icon()).toContain("group-data-[panel-open]/accordion-trigger:rotate-180");
    expect(slots.content()).toBe(`${panelHeightTransition} h-(--accordion-panel-height)`);
    expect(slots.content()).not.toContain("motion-reduce");
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

describe("Accordion parts", () => {
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
