import { createRef } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { headingNamed, px, renderThemed } from "../../../test/themed-browser-render";
import { TimelineList } from "./timeline-list";

function listRoot(): HTMLElement {
  const element = page.getByRole("list").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a list");
  }
  return element;
}

function listItems(): HTMLElement[] {
  return page
    .getByRole("listitem")
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function decorativeDots(): HTMLElement[] {
  return listItems().flatMap((item) =>
    [...item.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.tagName === "SPAN" &&
        child.getAttribute("aria-hidden") === "true"
    )
  );
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
    expect(headingNamed("Order placed", 3)).toBeDefined();
    expect(headingNamed("Meter reading received")).toBeDefined();
    expect(page.getByText("Confirmed at checkout.").element()).toBeDefined();
    expect(page.getByText("3 March 2024").element()).toBeDefined();
    expect(listRoot().tagName).toBe("OL");
  });

  it("hides the decorative dot from the accessibility tree", () => {
    renderBasicList();
    const dots = decorativeDots();
    expect(dots).toHaveLength(3);
    for (const dot of dots) {
      expect(dot.tagName).toBe("SPAN");
      expect(dot.getAttribute("aria-hidden")).toBe("true");
    }
    expect(listItems()).toHaveLength(3);
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
    expect(px(getComputedStyle(defaultTitle).marginBottom)).toBe(0);
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
            className="font-semibold"
            id="placed-at">
            3 March 2024
          </TimelineList.Time>
          <TimelineList.Description ref={descriptionRef} className="text-sm" id="placed-copy">
            Confirmed at checkout.
          </TimelineList.Description>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    const root = listRoot();
    expect(rootRef.current).toBe(root);
    expect(root.id).toBe("history");
    expect(root.getAttribute("data-track")).toBe("orders");
    expect(getComputedStyle(root).listStyleType).toBe("none");
    expect(px(getComputedStyle(root).maxWidth)).toBe(448);

    const item = listItems()[0];
    if (!(item instanceof HTMLElement)) {
      throw new Error("expected a listitem");
    }
    expect(itemRef.current).toBe(item);
    expect(item.getAttribute("data-step")).toBe("1");
    expect(getComputedStyle(item).boxShadow).not.toBe("none");

    const title = headingNamed("Order placed");
    expect(getComputedStyle(title).textTransform).toBe("uppercase");

    const time = page.getByText("3 March 2024", { exact: true }).element();
    if (!(time instanceof HTMLTimeElement)) {
      throw new Error("expected a time element");
    }
    expect(timeRef.current).toBe(time);
    expect(time.id).toBe("placed-at");
    expect(getComputedStyle(time).fontWeight).toBe("600");
    expect(time.getAttribute("datetime")).toBe("2024-03-03T10:00:00.000Z");

    const description = page.getByText("Confirmed at checkout.", { exact: true }).element();
    if (!(description instanceof HTMLElement)) {
      throw new Error("expected the description");
    }
    expect(descriptionRef.current).toBe(description);
    expect(description.id).toBe("placed-copy");
    expect(px(getComputedStyle(description).fontSize)).toBe(14);
  });
});
