import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectActivationCancelled, resetHashAroundEach } from "../../../test/aria-disabled-activation";
import { settleTransitions } from "../../../test/assert-invalid-ring";
import { assertNoAxeViolations } from "../../../test/axe";
import { MUTED, PANEL, describePartPaint } from "../../../test/surface-paint";
import type { PartCase } from "../../../test/surface-paint";
import { cssVarColor, renderThemed, roleNamed, textNamed } from "../../../test/themed-browser-render";
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
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

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

  it("makes a link-rendered item a keyboard-activatable link", async () => {
    renderThemed(
      <Item.Root render={<a href="#order" />}>
        <Item.Title>Order</Item.Title>
      </Item.Root>
    );
    const initialHash = window.location.hash;
    try {
      roleNamed("link", "Order").focus();
      await userEvent.keyboard("{Enter}");
      await vi.waitFor(() => {
        expect(window.location.hash).toBe("#order");
      });
    } finally {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${initialHash}`);
    }
  });
});

describe("aria-disabled Item rows", () => {
  // A link takes no native `disabled`, so a link row announced unavailable cancels its own
  // activation.
  resetHashAroundEach();

  it.each([
    { name: "on the root", root: { "aria-disabled": "true" }, link: {} },
    { name: "on the render element", root: {}, link: { "aria-disabled": "true" } },
  ] as const)(
    "neither follows a link row nor runs its onClick with aria-disabled $name",
    async ({ root, link }) => {
      const clicks: string[] = [];
      renderThemed(
        <Item.Root {...root} render={<a href="#profile" {...link} />} onClick={() => clicks.push("profile")}>
          <Item.Title>Profile</Item.Title>
        </Item.Root>
      );

      await expectActivationCancelled(roleNamed("link", "Profile"), clicks);
    }
  );

  it("dims an aria-disabled link row with the not-allowed cursor and keeps it unfilled on hover", async () => {
    renderThemed(
      <Item.Root render={<a href="#profile" aria-disabled="true" />}>
        <Item.Title>Profile</Item.Title>
      </Item.Root>
    );
    const link = roleNamed("link", "Profile");
    await userEvent.hover(link);
    settleTransitions(link);
    const style = getComputedStyle(link);
    expect(style.opacity).toBe("0.5");
    expect(style.cursor).toBe("not-allowed");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("dims a disabled button row with the not-allowed cursor", () => {
    renderThemed(
      <Item.Root render={<button type="button" disabled />}>
        <Item.Title>Profile</Item.Title>
      </Item.Root>
    );
    const style = getComputedStyle(roleNamed("button", "Profile"));
    expect(style.opacity).toBe("0.5");
    expect(style.cursor).toBe("not-allowed");
  });

  it("lets a link inside a plain aria-disabled row navigate", async () => {
    renderThemed(
      <Item.Root aria-disabled="true">
        <Item.Title>Profile</Item.Title>
        <Item.Actions>
          <a href="#help">Help</a>
        </Item.Actions>
      </Item.Root>
    );

    // Playwright counts an element under an `aria-disabled` ancestor as disabled; `force` skips
    // that check so the click reaches the link the way a user's pointer does.
    await userEvent.click(roleNamed("link", "Help"), { force: true });
    expect(location.hash).toBe("#help");
  });

  it("fills an enabled link row on hover", async () => {
    renderThemed(
      <Item.Root render={<a href="#profile" aria-disabled="false" />}>
        <Item.Title>Profile</Item.Title>
      </Item.Root>
    );
    const link = roleNamed("link", "Profile");
    await userEvent.hover(link);
    settleTransitions(link);
    expect(getComputedStyle(link).backgroundColor).toBe(cssVarColor(link, "--muted"));
    expect(getComputedStyle(link).opacity).toBe("1");
  });
});

describe("Item", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

  it("keeps a grouped separator out of the list's children, and an ungrouped one a separator", async () => {
    const { host } = renderThemed(
      <>
        <Item.Group aria-label="Addresses">
          <Item.Root>
            <Item.Title>Storgata 1</Item.Title>
          </Item.Root>
          <Item.Separator />
          <Item.Root>
            <Item.Title>Kirkeveien 22</Item.Title>
          </Item.Root>
        </Item.Group>
        <Item.Separator aria-label="Between sections" />
      </>
    );
    expect(page.getByRole("list").getByRole("separator").query()).toBeNull();
    expect(roleNamed("separator", "Between sections").getAttribute("data-slot")).toBe("item-separator");
    // Every child the list owns in the accessibility tree is a listitem; the separator stays
    // painted but hidden from assistive technology.
    const list = roleNamed("list", "Addresses");
    const exposed = [...list.children].filter((child) => child.getAttribute("aria-hidden") !== "true");
    expect(exposed.map((child) => child.getAttribute("role"))).toEqual(["listitem", "listitem"]);
    expect(list.children).toHaveLength(3);
    await assertNoAxeViolations(host);
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

  it("honors an explicit inert on a visible footer", async () => {
    renderThemed(<FooterTree mode="visible" inert />);
    const nestedButton = footerButton("Nested");

    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "After"));

    nestedButton.focus();
    expect(document.activeElement).not.toBe(nestedButton);
  });
});

// The fill the outline Item paints at rest and as a hovered link row, the text that travels with
// it and the surface it states (see `surface-paint.tsx`).
const ITEM_PARTS: readonly PartCase[] = [
  {
    label: "the outline Item",
    node: (className) => (
      <Item.Root variant="outline" className={className}>
        <Item.Content>Usage row</Item.Content>
      </Item.Root>
    ),
    text: () => textNamed("Usage row"),
    role: "--panel-foreground",
    fill: PANEL,
  },
  {
    label: "a hovered outline link Item",
    node: (className) => (
      <Item.Root variant="outline" className={className} render={<a href="#usage" />}>
        <Item.Content>Usage row</Item.Content>
      </Item.Root>
    ),
    text: () => textNamed("Usage row"),
    role: "--foreground",
    fill: MUTED,
    hover: () => roleNamed("link", "Usage row"),
  },
];

describePartPaint(ITEM_PARTS);
