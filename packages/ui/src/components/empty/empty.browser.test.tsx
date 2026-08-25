import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Empty } from "./empty";

function slot(name: string): HTMLElement {
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

function textNamed(name: string): HTMLElement {
  const element = page.getByText(name, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected text ${name}`);
  }
  return element;
}

describe("Empty", () => {
  it("renders title, description, and content children reachable by text", () => {
    renderThemed(
      <Empty.Root>
        <Empty.Header>
          <Empty.Title>No orders yet</Empty.Title>
          <Empty.Description>Orders you create will show up here.</Empty.Description>
        </Empty.Header>
        <Empty.Content>Create order</Empty.Content>
      </Empty.Root>
    );
    expect(textNamed("No orders yet")).toBe(slot("empty-title"));
    expect(textNamed("Orders you create will show up here.")).toBe(slot("empty-description"));
    expect(textNamed("Create order")).toBe(slot("empty-content"));
  });

  it("reaches actions inside Content via button and link roles", () => {
    renderThemed(
      <Empty.Root>
        <Empty.Content>
          <button type="button">Create order</button>
          <a href="/orders">View orders</a>
        </Empty.Content>
      </Empty.Root>
    );
    expect(page.getByRole("button", { name: "Create order" }).element()).toBeDefined();
    expect(page.getByRole("link", { name: "View orders" }).element()).toBeDefined();
  });

  it("does not emit a heading role from Title", () => {
    renderThemed(
      <Empty.Root>
        <Empty.Header>
          <Empty.Title>No orders yet</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    );
    expect(page.getByRole("heading").elements()).toHaveLength(0);
    expect(slot("empty-title").tagName).toBe("DIV");
  });

  it("renders Description as a p", () => {
    renderThemed(
      <Empty.Root>
        <Empty.Header>
          <Empty.Description>Orders you create will show up here.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    );
    expect(slot("empty-description").tagName).toBe("P");
  });

  it("emits empty-media and data-variant on Media", () => {
    renderThemed(
      <>
        <Empty.Media>illustration</Empty.Media>
        <Empty.Media variant="icon">icon</Empty.Media>
      </>
    );
    const media = document.querySelectorAll('[data-slot="empty-media"]');
    expect(media).toHaveLength(2);
    expect(document.querySelector('[data-slot="empty-icon"]')).toBeNull();
    expect(media[0]?.getAttribute("data-variant")).toBe("default");
    expect(media[1]?.getAttribute("data-variant")).toBe("icon");
  });

  it("puts border classes on outline roots and none on default", () => {
    renderThemed(
      <>
        <Empty.Root>Default</Empty.Root>
        <Empty.Root variant="outline">Outline</Empty.Root>
        <Empty.Root variant="outline-dashed">Dashed</Empty.Root>
      </>
    );
    const roots = document.querySelectorAll('[data-slot="empty"]');
    const [plain, outline, dashed] = [roots[0], roots[1], roots[2]];
    if (
      !(plain instanceof HTMLElement) ||
      !(outline instanceof HTMLElement) ||
      !(dashed instanceof HTMLElement)
    ) {
      throw new Error("expected three empty roots");
    }
    expect(plain.className.split(/\s+/)).not.toContain("border");
    expect(plain.className.split(/\s+/)).not.toContain("border-border");
    expect(outline.className.split(/\s+/)).toEqual(expect.arrayContaining(["border", "border-border"]));
    expect(outline.className.split(/\s+/)).not.toContain("border-dashed");
    expect(dashed.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["border", "border-dashed", "border-border"])
    );
  });

  it("keeps an inline description link focusable with the styled hooks", async () => {
    renderThemed(
      <Empty.Root>
        <Empty.Header>
          <Empty.Description>
            Read the <a href="#help">help article</a> to get started.
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    );
    const link = page.getByRole("link", { name: "help article" }).element();
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error("expected an inline description link");
    }
    expect(link.tagName).toBe("A");
    expect(link.parentElement).toBe(slot("empty-description"));
    expect(slot("empty-description").className).toContain("[&>a]:underline");
    expect(slot("empty-description").className).toContain("[&>a]:underline-offset-4");
    expect(slot("empty-description").className).toContain("[&>a:hover]:text-primary");
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
  });
});
