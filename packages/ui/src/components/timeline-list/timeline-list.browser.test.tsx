import { createRef } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { TimelineList } from "./timeline-list";

function slot(name: string): HTMLElement {
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

function headingNamed(name: string, level?: 1 | 2 | 3 | 4 | 5 | 6): HTMLElement {
  const element = page.getByRole("heading", { name, exact: true, level }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a heading named ${name}`);
  }
  return element;
}

function renderBasicList() {
  renderThemed(
    <TimelineList.Root>
      <TimelineList.Item>
        <TimelineList.Title>Order placed</TimelineList.Title>
        <TimelineList.Time date="2024-03-03T10:00:00.000Z">3 March 2024</TimelineList.Time>
        <TimelineList.Description>Confirmed at checkout.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Meter reading received</TimelineList.Title>
        <TimelineList.Time date="2024-03-12T08:30:00.000Z">12 March 2024</TimelineList.Time>
        <TimelineList.Description>Submitted by the customer.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Invoice issued</TimelineList.Title>
        <TimelineList.Time date="2024-04-01T00:00:00.000Z">1 April 2024</TimelineList.Time>
        <TimelineList.Description>Ready for payment.</TimelineList.Description>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}

describe("TimelineList", () => {
  it("renders one list containing the expected listitems and heading/text content", () => {
    renderBasicList();
    expect(page.getByRole("list").elements()).toHaveLength(1);
    expect(page.getByRole("listitem").elements()).toHaveLength(3);
    expect(page.getByRole("heading", { level: 3, name: "Order placed" }).element()).toBeDefined();
    expect(page.getByRole("heading", { name: "Meter reading received" }).element()).toBeDefined();
    expect(page.getByText("Confirmed at checkout.").element()).toBeDefined();
    expect(page.getByText("3 March 2024").element()).toBeDefined();
    expect(slot("timeline-list").tagName).toBe("OL");
  });

  it("hides the decorative dot from the accessibility tree", () => {
    renderBasicList();
    const dots = document.querySelectorAll('[data-slot="timeline-list-dot"]');
    expect(dots).toHaveLength(3);
    for (const dot of dots) {
      if (!(dot instanceof HTMLElement)) {
        throw new Error("expected a decorative dot element");
      }
      expect(dot.tagName).toBe("SPAN");
      expect(dot.getAttribute("aria-hidden")).toBe("true");
    }
    expect(page.getByRole("listitem").elements()).toHaveLength(3);
  });

  it("lets an explicit Title level override the default of 3 and keeps noMargin forced", () => {
    renderThemed(
      <TimelineList.Root>
        <TimelineList.Item>
          <TimelineList.Title>Default</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item>
          <TimelineList.Title level={2}>Outline</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    const defaultTitle = headingNamed("Default", 3);
    expect(defaultTitle.tagName).toBe("H3");
    expect(defaultTitle.getAttribute("data-slot")).toBe("timeline-list-title");
    expect(defaultTitle.className.split(/\s+/)).toContain("mb-0");
    const outline = headingNamed("Outline", 2);
    expect(outline.tagName).toBe("H2");
  });

  it("merges consumer className last and forwards native attributes and ref on each part", () => {
    const rootRef = createRef<HTMLOListElement>();
    const itemRef = createRef<HTMLLIElement>();
    const timeRef = createRef<HTMLTimeElement>();
    const descriptionRef = createRef<HTMLDivElement>();
    renderThemed(
      <TimelineList.Root ref={rootRef} id="history" className="max-w-md" data-track="orders">
        <TimelineList.Item ref={itemRef} className="ring-1" data-step="1">
          <TimelineList.Title className="uppercase">Order placed</TimelineList.Title>
          <TimelineList.Time
            ref={timeRef}
            date="2024-03-03T10:00:00.000Z"
            className="tabular-nums"
            id="placed-at">
            3 March 2024
          </TimelineList.Time>
          <TimelineList.Description ref={descriptionRef} className="text-sm" id="placed-copy">
            Confirmed at checkout.
          </TimelineList.Description>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    const root = slot("timeline-list");
    expect(rootRef.current).toBe(root);
    expect(root.id).toBe("history");
    expect(root.getAttribute("data-track")).toBe("orders");
    expect(root.className.split(/\s+/)).toEqual(expect.arrayContaining(["list-none", "max-w-md"]));

    const item = slot("timeline-list-item");
    expect(itemRef.current).toBe(item);
    expect(item.getAttribute("data-step")).toBe("1");
    expect(item.className.split(/\s+/)).toContain("ring-1");

    const title = headingNamed("Order placed");
    expect(title.className.split(/\s+/)).toContain("uppercase");

    const time = slot("timeline-list-time");
    expect(timeRef.current).toBe(time);
    expect(time.id).toBe("placed-at");
    expect(time.className.split(/\s+/)).toEqual(expect.arrayContaining(["text-foreground", "tabular-nums"]));
    expect(time.getAttribute("datetime")).toBe("2024-03-03T10:00:00.000Z");

    const description = slot("timeline-list-description");
    expect(descriptionRef.current).toBe(description);
    expect(description.id).toBe("placed-copy");
    expect(description.className.split(/\s+/)).toContain("text-sm");
  });
});
