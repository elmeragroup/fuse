import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Card } from "./card";

function slot(name: string): HTMLElement {
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

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
    const defaultTitle = page.getByRole("heading", { level: 3, name: "March usage" }).element();
    expect(defaultTitle.tagName).toBe("H3");
    const levelTwo = page.getByRole("heading", { level: 2, name: "April usage" }).element();
    expect(levelTwo.tagName).toBe("H2");
  });

  it("emits a data-slot on all eight parts", () => {
    renderThemed(
      <Card.Root>
        <Card.Header>
          <Card.Tag>Invoice</Card.Tag>
          <Card.Title>March usage</Card.Title>
          <Card.Description>Estimated consumption.</Card.Description>
          <Card.Action>
            <button type="button">Export</button>
          </Card.Action>
        </Card.Header>
        <Card.Content>Body</Card.Content>
        <Card.Footer>Footer</Card.Footer>
      </Card.Root>
    );
    for (const name of [
      "card",
      "card-header",
      "card-tag",
      "card-title",
      "card-description",
      "card-action",
      "card-content",
      "card-footer",
    ]) {
      expect(slot(name).getAttribute("data-slot"), name).toBe(name);
    }
    expect(slot("card-description").tagName).toBe("P");
    expect(slot("card-tag").tagName).toBe("DIV");
  });

  it("switches the header to two grid columns only when an action child exists", () => {
    renderThemed(
      <>
        <Card.Root>
          <Card.Header>
            <Card.Title>With action</Card.Title>
            <Card.Action>
              <button type="button">Export</button>
            </Card.Action>
          </Card.Header>
        </Card.Root>
        <Card.Root>
          <Card.Header>
            <Card.Title>Without action</Card.Title>
          </Card.Header>
        </Card.Root>
      </>
    );
    const headers = document.querySelectorAll("[data-slot=card-header]");
    const [withAction, withoutAction] = [headers[0], headers[1]];
    if (!(withAction instanceof HTMLElement) || !(withoutAction instanceof HTMLElement)) {
      throw new Error("expected two headers");
    }
    expect(withAction.className).toContain("has-data-[slot=card-action]:grid-cols-[1fr_auto]");
    expect(getComputedStyle(withAction).gridTemplateColumns.split(/\s+/)).toHaveLength(2);
    expect(getComputedStyle(withoutAction).gridTemplateColumns.split(/\s+/)).toHaveLength(1);
  });

  it("lays the root out as a row for direction=horizontal and a column by default", () => {
    renderThemed(
      <Card.Root direction="horizontal">
        <Card.Content direction="horizontal">Body</Card.Content>
      </Card.Root>
    );
    expect(getComputedStyle(slot("card")).flexDirection).toBe("row");
  });

  it("lays the root out as a column by default", () => {
    renderThemed(
      <Card.Root>
        <Card.Content>Body</Card.Content>
      </Card.Root>
    );
    expect(getComputedStyle(slot("card")).flexDirection).toBe("column");
  });

  it("renders the title icon before the text with the icon gap classes", () => {
    renderThemed(
      <Card.Root>
        <Card.Header>
          <Card.Title icon={<svg data-testid="bolt" aria-hidden />}>March usage</Card.Title>
        </Card.Header>
      </Card.Root>
    );
    const title = slot("card-title");
    expect(page.getByRole("heading", { level: 3, name: "March usage" }).element()).toBe(title);
    expect(title.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(title.className.split(/\s+/)).toContain("gap-x-1.5");
    expect(title.className.split(/\s+/)).toContain("items-center");
    expect(getComputedStyle(title).display).toBe("flex");
  });

  it("paints the card surface from tokens without a dark variant", () => {
    renderThemed(
      <Card.Root>
        <Card.Content>Body</Card.Content>
      </Card.Root>
    );
    const root = slot("card");
    const styles = getComputedStyle(root);
    expect(root.className).not.toContain("dark:");
    expect(root.className.split(/\s+/)).toContain("bg-card");
    expect(root.className.split(/\s+/)).toContain("text-card-foreground");
    expect(root.className).not.toMatch(/\b(?:bg|text|border)-(?:white|black|gray|zinc|slate|neutral)\b/);
    expect(styles.borderTopWidth).toBe("1px");
    // Radius derives from the brand `--radius` scale, never a literal (card.md §5).
    expect(root.className.split(/\s+/)).toContain("rounded-lg");
  });
});
