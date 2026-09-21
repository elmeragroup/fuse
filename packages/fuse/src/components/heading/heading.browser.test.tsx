import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, headingNamed, px, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Heading } from "./heading";

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
    const auto1 = px(getComputedStyle(headingNamed("Auto 1", 1)).fontSize);
    const auto2 = px(getComputedStyle(headingNamed("Auto 2", 2)).fontSize);
    const auto3 = px(getComputedStyle(headingNamed("Auto 3", 3)).fontSize);
    const override = px(getComputedStyle(headingNamed("Override", 1)).fontSize);
    expect(auto1).toBeGreaterThan(auto2);
    expect(auto2).toBeGreaterThan(auto3);
    expect(override).toBeGreaterThan(auto1);
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
    expect(getComputedStyle(headingNamed("Flush")).marginBottom).toBe("0px");
    expect(getComputedStyle(headingNamed("Shout")).textTransform).toBe("uppercase");
    expect(getComputedStyle(headingNamed("Centered")).textAlign).toBe("center");
    const tinted = headingNamed("Tinted");
    expect(getComputedStyle(tinted).color).toBe(cssVarColor(tinted, "--primary"));
  });

  it("renders the provided element with merged recipe classes", () => {
    renderThemed(
      <>
        <Heading>Details</Heading>
        <Heading render={<a href="#order" />}>Order overview</Heading>
      </>
    );
    const link = roleNamed("link", "Order overview");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#order");
    expect(link.getAttribute("data-slot")).toBe("heading");
    expect(getComputedStyle(link).fontSize).toBe(getComputedStyle(headingNamed("Details")).fontSize);
  });
});
