import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Heading } from "./heading";

function headingNamed(name: string, level?: 1 | 2 | 3 | 4 | 5 | 6): HTMLElement {
  const element = page.getByRole("heading", { name, exact: true, level }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a heading named ${name}`);
  }
  return element;
}

const LEVELS = [1, 2, 3, 4, 5, 6] as const;
const LEVEL_NAMES = {
  1: "Order overview",
  2: "Details",
  3: "Usage",
  4: "Period",
  5: "Meters",
  6: "Notes",
} as const;

describe("Heading", () => {
  it("defaults to heading level 2 with data-slot=heading", () => {
    renderThemed(<Heading>Order overview</Heading>);
    const heading = headingNamed("Order overview", 2);
    expect(heading.tagName).toBe("H2");
    expect(heading.getAttribute("data-slot")).toBe("heading");
  });

  it("renders each level as the matching heading tag", () => {
    renderThemed(
      <>
        {LEVELS.map((level) => (
          <Heading key={level} level={level}>
            {LEVEL_NAMES[level]}
          </Heading>
        ))}
      </>
    );
    for (const level of LEVELS) {
      const heading = headingNamed(LEVEL_NAMES[level], level);
      expect(heading.tagName).toBe(`H${level}`);
    }
  });

  it("maps auto size from level and lets an explicit size win", () => {
    renderThemed(
      <>
        <Heading level={1}>Auto 1</Heading>
        <Heading level={2}>Auto 2</Heading>
        <Heading level={3}>Auto 3</Heading>
        <Heading level={1} size="4xl">
          Override
        </Heading>
      </>
    );
    expect(headingNamed("Auto 1", 1).className.split(/\s+/)).toContain("text-2xl");
    expect(headingNamed("Auto 2", 2).className.split(/\s+/)).toContain("text-lg");
    expect(headingNamed("Auto 3", 3).className.split(/\s+/)).toContain("text-base");
    const override = headingNamed("Override", 1);
    expect(override.className.split(/\s+/)).toContain("text-4xl");
    expect(override.className.split(/\s+/)).not.toContain("text-2xl");
  });

  it("toggles noMargin, uppercase, and align, and lets className win", () => {
    renderThemed(
      <>
        <Heading noMargin>Flush</Heading>
        <Heading uppercase>Shout</Heading>
        <Heading align="center">Centered</Heading>
        <Heading className="text-primary">Tinted</Heading>
      </>
    );
    expect(headingNamed("Flush").className.split(/\s+/)).toContain("mb-0");
    expect(headingNamed("Shout").className.split(/\s+/)).toContain("uppercase");
    expect(headingNamed("Centered").className.split(/\s+/)).toContain("text-center");
    const tinted = headingNamed("Tinted");
    expect(tinted.className.split(/\s+/)).toContain("text-primary");
    expect(tinted.className.split(/\s+/)).not.toContain("text-inherit");
  });

  it("renders the provided element with merged recipe classes", () => {
    renderThemed(<Heading render={<a href="#order" />}>Order overview</Heading>);
    const link = page.getByRole("link", { name: "Order overview", exact: true }).element();
    if (!(link instanceof HTMLElement)) {
      throw new Error("expected a link named Order overview");
    }
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#order");
    expect(link.getAttribute("data-slot")).toBe("heading");
    expect(link.className.split(/\s+/)).toContain("font-heading");
    expect(link.className.split(/\s+/)).toContain("text-lg");
  });
});
