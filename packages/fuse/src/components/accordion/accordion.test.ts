import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { panelHeightTransition } from "../../styles/panel-height";
import { selfFocusRingClass } from "../../styles/utils";
import { accordionVariants } from "./accordion-variants";
import { Accordion } from "./index";

describe("accordionVariants", () => {
  it("keeps the shared panel-height transition, group chevron, and shared self focus ring", () => {
    const slots = accordionVariants();
    expect(slots.header()).toContain("flex");
    expect(slots.trigger()).toContain("group/accordion-trigger");
    // The open gap lives in the panel, so the trigger has no open-state padding.
    expect(slots.trigger()).not.toContain("data-[panel-open]:pb");
    expect(slots.trigger()).not.toContain("data-[state=open]");
    // Oracle: the shared focus recipe the part composes.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(slots.trigger()).toContain(token);
    }
    expect(slots.icon()).toContain("group-data-[panel-open]/accordion-trigger:rotate-180");
    // Oracle: the shared panel transition, which panel-height.test.ts pins by hand.
    expect(slots.content()).toBe(`${panelHeightTransition} h-(--accordion-panel-height)`);
    expect(slots.content()).not.toContain("motion-reduce");
    expect(slots.contentInner()).toContain("pt-[calc(var(--surface-gap-lg)+--spacing(1.5))]");
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
