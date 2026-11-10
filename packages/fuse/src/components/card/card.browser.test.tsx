import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { headingNamed, renderThemed, textNamed } from "../../../test/themed-browser-render";
import { Card } from "./card";

describe("Card", () => {
  it("renders the title as a level-3 heading by default and honours level", () => {
    renderThemed(
      <>
        <Card.Root>
          <Card.Header>
            <Card.Title>March usage</Card.Title>
          </Card.Header>
        </Card.Root>
        <Card.Root>
          <Card.Header>
            <Card.Title level={2}>April usage</Card.Title>
          </Card.Header>
        </Card.Root>
      </>
    );
    const defaultTitle = headingNamed("March usage", 3);
    expect(defaultTitle.tagName).toBe("H3");
    const levelTwo = headingNamed("April usage", 2);
    expect(levelTwo.tagName).toBe("H2");
  });

  it("renders default title type larger than the description", () => {
    renderThemed(
      <Card.Root>
        <Card.Header>
          <Card.Title>March usage</Card.Title>
          <Card.Description>Estimated consumption.</Card.Description>
        </Card.Header>
      </Card.Root>
    );
    const title = headingNamed("March usage", 3);
    const description = textNamed("Estimated consumption.");
    expect(Number.parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(description).fontSize)
    );
  });
});
