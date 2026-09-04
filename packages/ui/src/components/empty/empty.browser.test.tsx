import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Empty } from "./empty";

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
    expect(textNamed("No orders yet").tagName).toBe("DIV");
    expect(textNamed("Orders you create will show up here.").tagName).toBe("P");
    expect(textNamed("Create order").tagName).toBe("DIV");
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
    expect(roleNamed("button", "Create order")).toBeDefined();
    expect(roleNamed("link", "View orders")).toBeDefined();
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
    expect(textNamed("No orders yet").tagName).toBe("DIV");
  });

  it("renders Description as a p", () => {
    renderThemed(
      <Empty.Root>
        <Empty.Header>
          <Empty.Description>Orders you create will show up here.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    );
    expect(textNamed("Orders you create will show up here.").tagName).toBe("P");
  });

  it("emits empty-media and data-variant on Media", () => {
    renderThemed(
      <>
        <Empty.Media>illustration</Empty.Media>
        <Empty.Media variant="icon">icon</Empty.Media>
      </>
    );
    const illustration = textNamed("illustration");
    const icon = textNamed("icon");
    expect(illustration.getAttribute("data-slot")).toBe("empty-media");
    expect(illustration.getAttribute("data-slot")).not.toBe("empty-icon");
    expect(icon.getAttribute("data-slot")).toBe("empty-media");
    expect(illustration.getAttribute("data-variant")).toBe("default");
    expect(icon.getAttribute("data-variant")).toBe("icon");
  });

  it("puts a border on outline roots and none on default", () => {
    renderThemed(
      <>
        <Empty.Root>Default</Empty.Root>
        <Empty.Root variant="outline">Outline</Empty.Root>
        <Empty.Root variant="outline-dashed">Dashed</Empty.Root>
      </>
    );
    expect(getComputedStyle(textNamed("Default")).borderTopWidth).toBe("0px");
    expect(getComputedStyle(textNamed("Outline")).borderTopWidth).not.toBe("0px");
    expect(getComputedStyle(textNamed("Outline")).borderTopStyle).toBe("solid");
    expect(getComputedStyle(textNamed("Dashed")).borderTopWidth).not.toBe("0px");
    expect(getComputedStyle(textNamed("Dashed")).borderTopStyle).toBe("dashed");
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
    const link = roleNamed("link", "help article");
    expect(link.tagName).toBe("A");
    expect(link.parentElement).toBe(textNamed("Read the help article to get started."));
    expect(getComputedStyle(link).textDecorationLine).toContain("underline");
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
  });
});
