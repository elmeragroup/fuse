import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed, roleNamed, textNamed } from "../../../test/themed-browser-render";
import { Item } from "./index";

function footerHost(name: string): HTMLElement {
  const host = textNamed(name).closest("[data-mode]");
  if (!(host instanceof HTMLElement)) {
    throw new Error(`expected a footer around ${name}`);
  }
  return host;
}

function footerButton(name: string): HTMLElement {
  const button = footerHost(name).querySelector("button");
  if (!(button instanceof HTMLElement)) {
    throw new Error(`expected a button inside the ${name} footer`);
  }
  return button;
}

function FooterTree({ mode, inert }: { mode: "hidden" | "visible" | "default"; inert?: boolean }) {
  return (
    <>
      <button type="button">Before</button>
      <Item.Root>
        <Item.Title>Order</Item.Title>
        <Item.Footer mode={mode} inert={inert}>
          <button type="button">Nested</button>
        </Item.Footer>
      </Item.Root>
      <button type="button">After</button>
    </>
  );
}

describe("Item", () => {
  it.each([
    {
      render: "link",
      props: { variant: "outline", size: "sm", render: <a href="#order" /> },
      name: "Order",
      tagName: "A",
      variant: "outline",
      size: "sm",
    },
    {
      render: "button",
      props: { render: <button type="button" /> },
      name: "Activate",
      tagName: "BUTTON",
      variant: "default",
      size: "default",
    },
  ] as const)(
    "keeps data-slot, data-variant, and data-size on a $render render",
    ({ render, props, name, tagName, variant, size }) => {
      renderThemed(
        <Item.Root {...props}>
          <Item.Title>{name}</Item.Title>
        </Item.Root>
      );
      const element = roleNamed(render, name);
      expect(element.tagName).toBe(tagName);
      expect(element.getAttribute("data-slot")).toBe("item");
      expect(element.getAttribute("data-variant")).toBe(variant);
      expect(element.getAttribute("data-size")).toBe(size);
    }
  );

  it("defaults group children to listitem and lets an explicit role win", () => {
    renderThemed(
      <>
        <Item.Root>
          <Item.Title>Loose</Item.Title>
        </Item.Root>
        <Item.Group>
          <Item.Root>
            <Item.Title>Member</Item.Title>
          </Item.Root>
          <Item.Root role="presentation">
            <Item.Title>Override</Item.Title>
          </Item.Root>
          <Item.Separator />
        </Item.Group>
      </>
    );
    expect(textNamed("Loose").parentElement?.getAttribute("role")).toBeNull();
    const list = page.getByRole("list").element();
    if (!(list instanceof HTMLElement)) {
      throw new Error("expected an item group list");
    }
    expect(list.getAttribute("data-slot")).toBe("item-group");
    const member = textNamed("Member").parentElement;
    expect(member?.getAttribute("role")).toBe("listitem");
    expect(member?.getAttribute("data-slot")).toBe("item");
    expect(textNamed("Override").parentElement?.getAttribute("role")).toBe("presentation");
  });

  it.each([
    { role: "link", render: (key: string) => <a href={`#${key}`} /> },
    { role: "button", render: () => <button type="button" /> },
  ] as const)("keeps a grouped $role render's own role inside a listitem", ({ role, render }) => {
    const names = ["Storgata 1", "Kirkeveien 22"];
    renderThemed(
      <Item.Group>
        {names.map((name) => (
          <Item.Root key={name} render={render(name)}>
            <Item.Title>{name}</Item.Title>
          </Item.Root>
        ))}
      </Item.Group>
    );
    for (const name of names) {
      const element = roleNamed(role, name);
      expect(element.getAttribute("data-slot")).toBe("item");
      expect(element.parentElement?.getAttribute("role")).toBe("listitem");
    }
    expect(page.getByRole("list").getByRole("listitem").elements()).toHaveLength(names.length);
  });

  it("lets a grouped render with an explicit listitem role stand as the listitem itself", () => {
    renderThemed(
      <Item.Group>
        <Item.Root role="listitem" render={<a href="#profile" />}>
          <Item.Title>Profile</Item.Title>
        </Item.Root>
      </Item.Group>
    );
    const element = textNamed("Profile").closest("a");
    expect(element?.getAttribute("role")).toBe("listitem");
    expect(element?.parentElement?.getAttribute("data-slot")).toBe("item-group");
    expect(page.getByRole("list").getByRole("listitem").elements()).toHaveLength(1);
  });

  it.each([
    {
      on: "root",
      secret: (
        <Item.Root hidden render={<a href="#secret" />}>
          <Item.Title>Secret</Item.Title>
        </Item.Root>
      ),
    },
    {
      on: "render element",
      secret: (
        <Item.Root render={<a href="#secret" hidden />}>
          <Item.Title>Secret</Item.Title>
        </Item.Root>
      ),
    },
  ])("hides the listitem and its gap with hidden on the grouped $on", ({ secret }) => {
    function gapBetween(first: string, last: string, group: string): number {
      const scope = page.getByTestId(group);
      const above = scope.getByRole("link", { name: first }).element().getBoundingClientRect();
      const below = scope.getByRole("link", { name: last }).element().getBoundingClientRect();
      return below.top - above.bottom;
    }
    renderThemed(
      <>
        <Item.Group data-testid="without">
          <Item.Root render={<a href="#profile" />}>
            <Item.Title>Profile</Item.Title>
          </Item.Root>
          <Item.Root render={<a href="#invoices" />}>
            <Item.Title>Invoices</Item.Title>
          </Item.Root>
        </Item.Group>
        <Item.Group data-testid="with">
          <Item.Root render={<a href="#profile" />}>
            <Item.Title>Profile</Item.Title>
          </Item.Root>
          {secret}
          <Item.Root render={<a href="#invoices" />}>
            <Item.Title>Invoices</Item.Title>
          </Item.Root>
        </Item.Group>
      </>
    );
    expect(page.getByTestId("with").getByRole("listitem").elements()).toHaveLength(2);
    expect(gapBetween("Profile", "Invoices", "with")).toBe(gapBetween("Profile", "Invoices", "without"));
  });

  it.each([
    {
      on: "root",
      decor: (
        <Item.Root aria-hidden="true" render={<a href="#decor" />}>
          <Item.Title>Decor</Item.Title>
        </Item.Root>
      ),
    },
    {
      on: "render element",
      decor: (
        <Item.Root render={<a href="#decor" aria-hidden="true" />}>
          <Item.Title>Decor</Item.Title>
        </Item.Root>
      ),
    },
  ])("adds no accessible listitem with aria-hidden on the grouped $on", ({ decor }) => {
    renderThemed(
      <Item.Group>
        <Item.Root render={<a href="#profile" />}>
          <Item.Title>Profile</Item.Title>
        </Item.Root>
        {decor}
      </Item.Group>
    );
    expect(page.getByRole("list").getByRole("listitem").elements()).toHaveLength(1);
  });

  it("keeps a grouped item listed when its render element overrides the root's hidden", () => {
    renderThemed(
      <Item.Group>
        <Item.Root hidden render={<a href="#shown" hidden={false} />}>
          <Item.Title>Shown</Item.Title>
        </Item.Root>
      </Item.Group>
    );
    const link = roleNamed("link", "Shown");
    expect(link.parentElement?.getAttribute("role")).toBe("listitem");
    expect(page.getByRole("list").getByRole("listitem").elements()).toHaveLength(1);
  });

  it("emits media variant and footer mode without dark classes", () => {
    renderThemed(
      <Item.Root>
        <Item.Media variant="image">Portrait</Item.Media>
        <Item.Footer mode="hidden">Hidden</Item.Footer>
        <Item.Footer mode="visible">Visible</Item.Footer>
      </Item.Root>
    );
    const media = textNamed("Portrait");
    expect(media.getAttribute("data-variant")).toBe("image");
    const hidden = footerHost("Hidden");
    const visible = footerHost("Visible");
    expect(hidden.getAttribute("data-mode")).toBe("hidden");
    expect(visible.getAttribute("data-mode")).toBe("visible");
    expect(getComputedStyle(hidden).pointerEvents).toBe("none");
    expect(getComputedStyle(hidden).opacity).toBe("0");
    expect(getComputedStyle(visible).pointerEvents).not.toBe("none");
  });

  it("removes hidden footer content from tab order and programmatic focus, and keeps default and visible footers in it", async () => {
    const { rerender, unmount } = renderThemed(<FooterTree mode="hidden" />);
    const nestedButton = footerButton("Nested");

    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement, "Tab must skip the hidden footer").toBe(roleNamed("button", "After"));

    nestedButton.focus();
    expect(document.activeElement, "programmatic focus must not enter the hidden footer").not.toBe(
      nestedButton
    );

    rerender(<FooterTree mode="visible" />);
    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement, "a visible footer must return to tab order").toBe(nestedButton);

    unmount();

    for (const mode of ["default", "visible"] as const) {
      const fresh = renderThemed(<FooterTree mode={mode} />);
      roleNamed("button", "Before").focus();
      await userEvent.keyboard("{Tab}");
      expect(document.activeElement, mode).toBe(roleNamed("button", "Nested"));
      fresh.unmount();
    }
  });

  it("honors an explicit inert on a visible footer", async () => {
    renderThemed(<FooterTree mode="visible" inert />);
    const nestedButton = footerButton("Nested");

    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "After"));

    nestedButton.focus();
    expect(document.activeElement).not.toBe(nestedButton);
  });

  it("makes a link-rendered item keyboard-activatable with the shared focus ring", async () => {
    renderThemed(
      <>
        <a href="#before">Before</a>
        <Item.Root render={<a href="#order" />}>
          <Item.Title>Order</Item.Title>
        </Item.Root>
      </>
    );
    const previous = roleNamed("link", "Before");
    const link = roleNamed("link", "Order");
    const initialHash = window.location.hash;
    const setHash = (hash: string) => {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
    };

    try {
      // The ring helper's mouse arm clicks the link, which already navigates to #order.
      // Clearing the hash afterwards is what makes the Enter press below the only thing
      // that can set it — otherwise the navigation assertion is true before the key press.
      await assertFocusRingOnKeyboardAbsentOnMouse(previous, link);
      setHash("");
      expect(window.location.hash, "the Enter press must be the only navigation under test").toBe("");

      link.focus();
      await userEvent.keyboard("{Enter}");
      await vi.waitFor(() => {
        expect(window.location.hash, "Enter on a link-rendered item must navigate").toBe("#order");
      });
    } finally {
      setHash(initialHash);
    }
  });
});
