import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingOnKeyboardAbsentOnMouse, focusRingClippers } from "../../../test/assert-focus-ring";
import { hasIntermediateFrame, sampleFrames } from "../../../test/panel-transition";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import {
  ROW,
  metricPx,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Button } from "../button/button";
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

/** A footer that reveals a fixed-height block, with a button after the item to track. */
function RevealTree({ mode }: { mode: "hidden" | "visible" }) {
  return (
    <>
      <Item.Root>
        <Item.Title>Delivery</Item.Title>
        <Item.Footer mode={mode} style={{ flexBasis: "100%" }}>
          <div style={{ height: "80px" }}>Address fields</div>
        </Item.Footer>
      </Item.Root>
      <button type="button">Below</button>
    </>
  );
}

async function settledFooter(footer: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(footer.getAnimations().length).toBe(0);
  });
}

describe("Item", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

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

  it("joins a compact group's outline rows into one bordered list, wrapped link rows included", () => {
    renderThemed(
      <Item.Group variant="compact">
        <Item.Root variant="outline" render={<a href="#profile" />}>
          <Item.Title>Profile</Item.Title>
        </Item.Root>
        <Item.Root variant="outline">
          <Item.Title>Invoices</Item.Title>
        </Item.Root>
        <Item.Root variant="outline">
          <Item.Title>Notifications</Item.Title>
        </Item.Root>
      </Item.Group>
    );
    const rows = ["Profile", "Invoices", "Notifications"].map((name) => {
      const row = textNamed(name).parentElement;
      if (!(row instanceof HTMLElement)) {
        throw new Error(`expected an item around ${name}`);
      }
      return { row, style: getComputedStyle(row), box: row.getBoundingClientRect() };
    });
    const [first, middle, last] = rows;
    if (first === undefined || middle === undefined || last === undefined) {
      throw new Error("expected three rows");
    }
    expect(first.row.tagName, "the first row is the wrapped link").toBe("A");

    expect(middle.box.top - first.box.bottom, "no gap below the first row").toBe(0);
    expect(last.box.top - middle.box.bottom, "no gap below the middle row").toBe(0);

    // Each row draws its top edge; only the last row adds a bottom edge, so a shared edge is one line.
    for (const { style } of rows) {
      expect(style.borderTopWidth).toBe("1px");
    }
    expect(first.style.borderBottomWidth).toBe("0px");
    expect(middle.style.borderBottomWidth).toBe("0px");
    expect(last.style.borderBottomWidth).toBe("1px");

    // The md radius rounds only the list's outer corners.
    expect(first.style.borderTopLeftRadius).not.toBe("0px");
    expect(first.style.borderTopRightRadius).not.toBe("0px");
    expect(first.style.borderBottomLeftRadius).toBe("0px");
    for (const corner of ["borderTopLeftRadius", "borderBottomRightRadius"] as const) {
      expect(middle.style[corner], `middle ${corner}`).toBe("0px");
    }
    expect(last.style.borderTopLeftRadius).toBe("0px");
    expect(last.style.borderBottomLeftRadius).not.toBe("0px");
    expect(last.style.borderBottomRightRadius).not.toBe("0px");
  });

  function CompactRow({ name, link, hidden }: { name: string; link: boolean; hidden: boolean }) {
    const title = <Item.Title>{name}</Item.Title>;
    return link ? (
      <Item.Root variant="outline" hidden={hidden} render={<a href={`#${name}`} />}>
        {title}
      </Item.Root>
    ) : (
      <Item.Root variant="outline" hidden={hidden}>
        {title}
      </Item.Root>
    );
  }

  function CompactGroup({ link, hide }: { link: "top" | "bottom"; hide: "top" | "bottom" | "none" }) {
    return (
      <Item.Group variant="compact">
        <CompactRow name="Profile" link={link === "top"} hidden={hide === "top"} />
        <CompactRow name="Invoices" link={false} hidden={false} />
        <CompactRow name="Notifications" link={link === "bottom"} hidden={hide === "bottom"} />
      </Item.Group>
    );
  }

  function rowStyle(name: string): CSSStyleDeclaration {
    const row = textNamed(name).parentElement;
    if (!(row instanceof HTMLElement)) {
      throw new Error(`expected an item around ${name}`);
    }
    return getComputedStyle(row);
  }

  it.each(["top", "bottom"] as const)(
    "closes a compact group's outer corners on its visible rows, the %s row a wrapped link",
    (link) => {
      const { rerender } = renderThemed(<CompactGroup link={link} hide="bottom" />);
      let middle = rowStyle("Invoices");
      expect(middle.borderBottomWidth, "bottom row hidden").toBe("1px");
      expect(middle.borderBottomLeftRadius, "bottom row hidden").not.toBe("0px");
      expect(middle.borderBottomRightRadius, "bottom row hidden").not.toBe("0px");
      expect(middle.borderTopLeftRadius, "bottom row hidden").toBe("0px");

      rerender(<CompactGroup link={link} hide="top" />);
      middle = rowStyle("Invoices");
      expect(middle.borderTopLeftRadius, "top row hidden").not.toBe("0px");
      expect(middle.borderTopRightRadius, "top row hidden").not.toBe("0px");
      expect(middle.borderBottomWidth, "top row hidden").toBe("0px");
      expect(middle.borderBottomLeftRadius, "top row hidden").toBe("0px");

      rerender(<CompactGroup link={link} hide="none" />);
      middle = rowStyle("Invoices");
      expect(middle.borderTopLeftRadius, "all rows shown").toBe("0px");
      expect(middle.borderBottomLeftRadius, "all rows shown").toBe("0px");
      expect(middle.borderBottomWidth, "all rows shown").toBe("0px");
      const top = rowStyle("Profile");
      expect(top.borderTopLeftRadius, "all rows shown").not.toBe("0px");
      expect(top.borderTopRightRadius, "all rows shown").not.toBe("0px");
      const bottom = rowStyle("Notifications");
      expect(bottom.borderBottomWidth, "all rows shown").toBe("1px");
      expect(bottom.borderBottomLeftRadius, "all rows shown").not.toBe("0px");
      expect(bottom.borderBottomRightRadius, "all rows shown").not.toBe("0px");
    }
  );

  // The suite loads no preflight, so this also covers standalone hosts where the row's own
  // `display: flex` would beat the user-agent `[hidden]` rule.
  it.each([
    { hide: "top", link: "bottom" },
    { hide: "bottom", link: "top" },
  ] as const)("keeps a hidden direct $hide row of a compact group out of layout", ({ hide, link }) => {
    renderThemed(<CompactGroup link={link} hide={hide} />);
    const group = page.getByRole("list").element().getBoundingClientRect();
    const hiddenRow = textNamed(hide === "top" ? "Profile" : "Notifications");
    const middle = textNamed("Invoices").parentElement;
    if (!(middle instanceof HTMLElement) || !(hiddenRow.parentElement instanceof HTMLElement)) {
      throw new Error("expected an item around each title");
    }
    expect(hiddenRow.parentElement.getBoundingClientRect().height, "hidden row height").toBe(0);
    const box = middle.getBoundingClientRect();
    if (hide === "top") {
      expect(box.top, "the middle row starts the list").toBe(group.top);
    } else {
      expect(box.bottom, "the middle row ends the list").toBe(group.bottom);
    }
  });

  it.each(DENSITIES)(
    "gaps an Item group by the lg tier, and a group of sm or xs Items by the sm tier, at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <div>
          {(["default", "sm", "xs"] as const).map((size) => (
            <Item.Group key={size}>
              <Item.Root size={size}>
                <Item.Title>{`${size} first`}</Item.Title>
              </Item.Root>
              <Item.Root size={size}>
                <Item.Title>{`${size} second`}</Item.Title>
              </Item.Root>
            </Item.Group>
          ))}
        </div>
      );
      const between = (size: string) => {
        const first = textNamed(`${size} first`).parentElement;
        const second = textNamed(`${size} second`).parentElement;
        if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) {
          throw new Error(`expected two ${size} Items`);
        }
        return second.getBoundingClientRect().top - first.getBoundingClientRect().bottom;
      };
      expect(between("default"), "default").toBe(metricPx("surface-gap-lg", density));
      expect(between("sm"), "sm").toBe(metricPx("surface-gap-sm", density));
      expect(between("xs"), "xs").toBe(metricPx("surface-gap-sm", density));
    }
  );

  it.each(DENSITIES)(
    "pads a default Item with the medium tier on every side and gaps it by the md gap, at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <Item.Root>
          <Item.Content>
            <Item.Title>Tile</Item.Title>
          </Item.Content>
          <Item.Actions>
            <Button size="sm">Open</Button>
          </Item.Actions>
        </Item.Root>
      );
      // DOM audit: Item.Root has no role of its own, so the shell is found by its public slot.
      const root = textNamed("Tile").closest('[data-slot="item"]');
      if (!(root instanceof HTMLElement)) {
        throw new Error("expected the Item root");
      }
      const style = getComputedStyle(root);
      expect(style.padding).toBe(`${metricPx("surface-pad-md", density)}px`);
      expect(style.columnGap).toBe(`${metricPx("surface-gap-md", density)}px`);
    }
  );

  it.each(DENSITIES)(
    "pads an sm Item as a tile edge over the row inset, and an xs Item as a row, at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <div>
          <Item.Root size="sm">
            <Item.Title>Small</Item.Title>
          </Item.Root>
          <Item.Root size="xs">
            <Item.Title>Extra small</Item.Title>
          </Item.Root>
        </div>
      );
      const box = (name: string) => {
        // DOM audit: Item.Root has no role of its own, so the shell is found by its public slot.
        const root = textNamed(name).closest('[data-slot="item"]');
        if (!(root instanceof HTMLElement)) {
          throw new Error(`expected the ${name} Item root`);
        }
        const style = getComputedStyle(root);
        return { block: style.paddingTop, inline: style.paddingLeft, gap: style.columnGap };
      };
      const gap = `${metricPx("surface-gap-sm", density)}px`;
      expect(box("Small")).toEqual({
        block: `${ROW[density].px}px`,
        inline: `${metricPx("surface-pad-md", density)}px`,
        gap,
      });
      expect(box("Extra small")).toEqual({
        block: `${ROW[density].py}px`,
        inline: `${ROW[density].px}px`,
        gap,
      });
    }
  );

  it.each(DENSITIES)(
    "pads compact rows with the medium tier, sm rows with the row inset, at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <Item.Group variant="compact">
          <Item.Root>
            <Item.Title>Above</Item.Title>
          </Item.Root>
          <Item.Separator />
          <Item.Root size="sm">
            <Item.Title>Below</Item.Title>
          </Item.Root>
        </Item.Group>
      );
      const above = textNamed("Above").parentElement;
      const below = textNamed("Below").parentElement;
      const separator = page.getByRole("separator").element();
      if (
        !(above instanceof HTMLElement) ||
        !(below instanceof HTMLElement) ||
        !(separator instanceof HTMLElement)
      ) {
        throw new Error("expected two rows and a separator");
      }
      expect(getComputedStyle(above).padding).toBe(`${metricPx("surface-pad-md", density)}px`);
      expect(getComputedStyle(below).padding).toBe(`${ROW[density].px}px`);
      expect(separator.getBoundingClientRect().top).toBe(above.getBoundingClientRect().bottom);
      expect(below.getBoundingClientRect().top).toBe(separator.getBoundingClientRect().bottom);
    }
  );

  it("moves the content below a footer through every frame of a reveal and a hide", async () => {
    const { rerender } = renderThemed(<RevealTree mode="hidden" />);
    const footer = footerHost("Address fields");
    const below = (): number => roleNamed("button", "Below").getBoundingClientRect().top;
    // The grid row alone, without the top padding that tweens beside it.
    const row = (): number =>
      footer.getBoundingClientRect().height - Number.parseFloat(getComputedStyle(footer).paddingTop);
    const collapsed = below();

    rerender(<RevealTree mode="visible" />);
    const revealing = await sampleFrames(20, row);
    await settledFooter(footer);
    const expanded = below();
    // Oracle: the revealed block's own 80px plus `pt-3`, 12px at the fixed 0.25rem spacing,
    // which a hidden footer drops.
    expect(expanded - collapsed).toBeCloseTo(80 + 12, 0);
    expect(row()).toBeCloseTo(80, 0);
    expect(hasIntermediateFrame(revealing, 0, 80), "the row must not jump open").toBe(true);

    rerender(<RevealTree mode="hidden" />);
    const hiding = await sampleFrames(20, row);
    await settledFooter(footer);
    expect(below()).toBeCloseTo(collapsed, 0);
    expect(row()).toBeCloseTo(0, 0);
    expect(hasIntermediateFrame(hiding, 80, 0), "the row must not jump shut").toBe(true);
  });

  it("snaps a footer's height under reduced motion and keeps its fade", async () => {
    const { rerender } = renderThemed(<RevealTree mode="hidden" />);
    const footer = footerHost("Address fields");
    try {
      await emulateReducedMotion("reduce");
      expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
      const properties = getComputedStyle(footer)
        .transitionProperty.split(",")
        .map((part) => part.trim());
      expect(properties).toContain("opacity");
      for (const layout of ["grid-template-rows", "padding-top", "translate"]) {
        expect(properties).not.toContain(layout);
      }

      const below = (): number => roleNamed("button", "Below").getBoundingClientRect().top;
      const collapsed = below();
      rerender(<RevealTree mode="visible" />);
      const revealing = await sampleFrames(5, below);
      await settledFooter(footer);
      expect(below()).toBeGreaterThan(collapsed + 80);
      expect(revealing.every((top) => Math.abs(top - below()) < 0.5)).toBe(true);
    } finally {
      await emulateReducedMotion("no-preference");
    }
  });

  it("paints the whole focus ring of content at the edges of a visible footer", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Item.Root className="px-0 py-0">
          <Item.Title>Order</Item.Title>
          <Item.Footer mode="visible" style={{ flexBasis: "100%" }}>
            <Button className="w-full">Edge to edge</Button>
          </Item.Footer>
        </Item.Root>
      </>
    );
    const footer = footerHost("Edge to edge");
    await settledFooter(footer);
    const button = roleNamed("button", "Edge to edge");
    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(button.matches(":focus-visible")).toBe(true);
    // The shared ring: 2px outside a 2px offset, the 4px the clipper check measures.
    expect(getComputedStyle(button).getPropertyValue("--tw-ring-offset-width")).toBe("2px");
    expect(focusRingClippers(button), "no ancestor clips the ring's box").toEqual([]);

    // The ring room does not narrow the footer: a full-width child spans the item's content box.
    // DOM audit: the item root is the footer's parent, which has no role or name of its own.
    const root = footer.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the item root around the footer");
    }
    const rootBox = root.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    expect(buttonBox.left).toBeCloseTo(rootBox.left + root.clientLeft, 0);
    expect(buttonBox.right).toBeCloseTo(rootBox.left + root.clientLeft + root.clientWidth, 0);
  });

  it("clips a hidden or visible footer's content, and never a default footer's", () => {
    renderThemed(
      <Item.Root>
        <Item.Footer mode="hidden">Hidden</Item.Footer>
        <Item.Footer mode="visible">Visible</Item.Footer>
        <Item.Footer>Default</Item.Footer>
      </Item.Root>
    );
    // DOM audit: the clip sits on the footer's inner content element, which has no role.
    const content = (name: string): Element | null => footerHost(name).firstElementChild;
    for (const name of ["Hidden", "Visible"]) {
      const element = content(name);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`expected the ${name} footer's content`);
      }
      expect(getComputedStyle(element).overflowY, name).toBe("clip");
    }
    for (let node = textNamed("Default"); node !== document.body;) {
      expect(getComputedStyle(node).overflowY).toBe("visible");
      const parent = node.parentElement;
      if (parent === null) {
        break;
      }
      node = parent;
    }
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

  it("keeps a hidden footer's content out of its scroll container's overflow", async () => {
    // Twelve lines of text, so the footer's column of flex items cannot shrink below them.
    const deliveryLines = Array.from({ length: 12 }, (_, index) => `Delivery detail ${index + 1}`);
    function Scroller({ mode }: { mode: "hidden" | "visible" }) {
      return (
        <div role="region" aria-label="Orders" style={{ height: "120px", overflow: "auto" }}>
          <Item.Root>
            <Item.Title>Order</Item.Title>
            <Item.Footer mode={mode}>
              {deliveryLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </Item.Footer>
          </Item.Root>
        </div>
      );
    }
    const { rerender } = renderThemed(<Scroller mode="hidden" />);
    const scroller = roleNamed("region", "Orders");

    // The row alone fits in 120px, so a collapsed footer leaves nothing to scroll to.
    expect(scroller.scrollHeight).toBe(scroller.clientHeight);

    // The same content, revealed, does overflow once the row has grown: the check above
    // measures the clip.
    rerender(<Scroller mode="visible" />);
    await settledFooter(footerHost("Delivery detail 1"));
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight * 2);
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
