import { describe, expect, it } from "vitest";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { withLocale } from "../../test/locale-matrix";
import { cssVarColor, fkasExternal, renderThemed, roleNamed } from "../../test/themed-browser-render";
import { Accordion } from "../components/accordion";
import { Attachment } from "../components/attachment";
import { Breadcrumb } from "../components/breadcrumb";
import { Button } from "../components/button/button";
import { Collapsible } from "../components/collapsible";
import { Combobox } from "../components/combobox";
import { Input } from "../components/input/input";
import { Item } from "../components/item";
import { Pagination } from "../components/pagination";
import { Sidebar } from "../components/sidebar";
import { Textarea } from "../components/textarea/textarea";
import { Toggle } from "../components/toggle/toggle";
import { Plus } from "../icons/generated/plus";
import { Link } from "../react-aria/link/link";
import { ThemeScope } from "../theme";

// Fuse ships no preflight, and this suite loads only its standalone sheets, as a host without
// preflight does. Unit under test: the base-layer reset in `fuse.css` for Fuse's own buttons,
// links and lists. Oracle: the face Tailwind's preflight gives those elements, so none of the
// browser's own: no fill, border, padding, button font, underline or list marker, and the text
// colour and font of the box around each part.
const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** The `nth` element with this `data-slot` and tag, so a part's button and link rows differ. */
function part(slot: string, tag: string, nth = 0): HTMLElement {
  const matches = [...document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)].filter(
    (element) => element.tagName === tag.toUpperCase()
  );
  const element = matches[nth];
  if (element === undefined) {
    throw new Error(`Expected <${tag}> number ${nth} with data-slot="${slot}"`);
  }
  return element;
}

/** The element's parent, whose colour and font an inheriting part takes. */
function parentOf(element: HTMLElement): HTMLElement {
  const parent = element.parentElement;
  if (parent === null) {
    throw new Error(`Expected <${element.tagName.toLowerCase()}> to have a parent`);
  }
  return parent;
}

function Parts() {
  return (
    <div>
      <button type="button" data-testid="bare">
        Bare
      </button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="outline">Outline</Button>
      <Toggle aria-label="Favourite">F</Toggle>
      <Input aria-label="Meter number" defaultValue="7070" />
      <Textarea aria-label="Note" defaultValue="Ring the bell" />
      <Link href="#terms">Terms of delivery</Link>
      <Collapsible.Root>
        <Collapsible.Trigger>Show details</Collapsible.Trigger>
        <Collapsible.Content>Delivery window and meter point.</Collapsible.Content>
      </Collapsible.Root>
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="#home">Home</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>Orders</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
      <Pagination.Root>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous href="#previous" />
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Link href="#1" isActive>
              1
            </Pagination.Link>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Link href="#2">2</Pagination.Link>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Next href="#next" />
          </Pagination.Item>
        </Pagination.Content>
      </Pagination.Root>
      <Accordion.Root>
        <Accordion.Item value="shipping">
          <Accordion.Header>
            <Accordion.Trigger>Shipping</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Within five days.</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
      <Combobox.Root items={["Bergen", "Oslo"]}>
        <Combobox.Trigger aria-label="Open municipalities" />
      </Combobox.Root>
      <Item.Root render={<button type="button" />}>
        <Item.Content>
          <Item.Title>Choose this product</Item.Title>
        </Item.Content>
      </Item.Root>
      <Item.Root render={<a href="#order" />}>
        <Item.Content>
          <Item.Title>Open order</Item.Title>
        </Item.Content>
      </Item.Root>
      <Attachment.Root>
        <Attachment.Trigger aria-label="Open report.pdf" render={<a href="#report" />} />
        <Attachment.Content>
          <Attachment.Title>report.pdf</Attachment.Title>
        </Attachment.Content>
      </Attachment.Root>
      <Sidebar.Provider>
        <Sidebar.Root collapsible="none">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Views</Sidebar.GroupLabel>
              <Sidebar.GroupAction aria-label="Add a view">
                <Plus />
              </Sidebar.GroupAction>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>Orders</Sidebar.MenuButton>
                    <Sidebar.MenuAction aria-label="More about orders">
                      <Plus />
                    </Sidebar.MenuAction>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton render={<a href="#customers" />}>Customers</Sidebar.MenuButton>
                    <Sidebar.MenuSub>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton href="#private">Private</Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton render={<button type="button" />}>
                          Business
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    </Sidebar.MenuSub>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Rail />
        </Sidebar.Root>
      </Sidebar.Provider>
    </div>
  );
}

/** Parts composed through `render` with the consumer's own fill, colour and underline. */
function StyledRenders() {
  const styled = "bg-primary text-error underline";
  return (
    <div>
      <Button variant="ghost" nativeButton={false} render={<a href="#button" className={styled} />}>
        Button link
      </Button>
      <Item.Root render={<a href="#item" className={styled} />}>
        <Item.Content>
          <Item.Title>Item link</Item.Title>
        </Item.Content>
      </Item.Root>
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link render={<a href="#crumb" className={styled} />}>Crumb</Breadcrumb.Link>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
      <Sidebar.Provider>
        <Sidebar.Root collapsible="none">
          <Sidebar.Content>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton render={<a href="#row" className={styled} />}>Row</Sidebar.MenuButton>
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton render={<a href="#sub-row" className={styled} />}>
                      Sub-row
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Content>
        </Sidebar.Root>
      </Sidebar.Provider>
    </div>
  );
}

describe("native face resets under the classes around them", () => {
  it("lets a render element's own fill, colour and underline win", () => {
    // Base UI joins a `render` element's classes without tailwind-merge, so the reset must weigh
    // less than any class there, with or without preflight. Oracle: the scope's own `--primary`
    // and `--error`, and `underline`.
    renderThemed(
      withLocale(
        "en-US",
        <ThemeScope theme={fkasExternal}>
          <StyledRenders />
        </ThemeScope>
      )
    );
    // The sub-row sets its own `text-sidebar-foreground`, which predates the reset, so only its
    // fill and underline are the reset's to yield.
    for (const href of ["#button", "#item", "#crumb", "#row", "#sub-row"]) {
      const link = document.querySelector<HTMLElement>(`a[href="${href}"]`);
      if (link === null) {
        throw new Error(`Expected the ${href} link`);
      }
      const style = getComputedStyle(link);
      expect.soft(style.backgroundColor, href).toBe(cssVarColor(link, "--primary"));
      if (href !== "#sub-row") {
        expect.soft(style.color, href).toBe(cssVarColor(link, "--error"));
      }
      expect.soft(style.textDecorationLine, href).toBe("underline");
    }
  });

  it("keeps Pagination's own space below its list", () => {
    // `Pagination.Root` spaces its children with `space-y-4`, a zero-weight utility, so the list's
    // margin reset must weigh less than it. Oracle: `space-y-4` is 1rem.
    renderThemed(
      withLocale(
        "en-US",
        <Pagination.Root>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Link href="#1">1</Pagination.Link>
            </Pagination.Item>
          </Pagination.Content>
          <p>Page 1 of 9</p>
        </Pagination.Root>
      )
    );
    expect(getComputedStyle(part("pagination-content", "ul")).marginBlockEnd).toBe(
      getComputedStyle(document.documentElement).fontSize
    );
  });
});

describe.each(["light", "dark"] as const)("native faces without preflight, %s", (scheme) => {
  function mount(): void {
    // fkas external tints the page, so a leftover browser grey or link blue reads as a mismatch.
    const scope = (
      <ThemeScope theme={fkasExternal}>
        <Parts />
      </ThemeScope>
    );
    renderThemed(withLocale("en-US", scheme === "dark" ? <div data-theme="dark">{scope}</div> : scope));
  }

  /** Every Fuse button below, which the browser would give its own face. */
  function buttons(): [string, HTMLElement][] {
    return [
      ["ghost Button", roleNamed("button", "Ghost")],
      ["link Button", roleNamed("button", "Link")],
      ["Toggle", part("toggle", "button")],
      ["Collapsible trigger", part("collapsible-trigger", "button")],
      ["Accordion trigger", part("accordion-trigger", "button")],
      ["Combobox trigger", part("combobox-trigger", "button")],
      ["Item button", part("item", "button")],
      ["Sidebar row button", part("sidebar-menu-button", "button")],
      ["Sidebar sub-row button", part("sidebar-menu-sub-button", "button")],
      ["Sidebar group action", part("sidebar-group-action", "button")],
      ["Sidebar menu action", part("sidebar-menu-action", "button")],
      ["Sidebar rail", part("sidebar-rail", "button")],
    ];
  }

  it("leaves a bare native button the browser's face, so the parts below are tested without preflight", () => {
    mount();
    const bare = document.querySelector<HTMLElement>('[data-testid="bare"]');
    if (bare === null) {
      throw new Error("Expected the bare button");
    }
    expect(getComputedStyle(bare).backgroundColor).not.toBe(TRANSPARENT);
    expect(getComputedStyle(bare).fontFamily).not.toBe(getComputedStyle(parentOf(bare)).fontFamily);
  });

  it("rests every button with no fill of its own on none, with no border of the browser's", () => {
    mount();
    for (const [name, element] of buttons()) {
      const style = getComputedStyle(element);
      expect.soft(style.backgroundColor, name).toBe(TRANSPARENT);
      expect.soft(style.borderTopStyle, name).not.toBe("outset");
    }
  });

  it("sets every button in the font of the box around it", () => {
    mount();
    for (const [name, element] of buttons()) {
      expect
        .soft(getComputedStyle(element).fontFamily, name)
        .toBe(getComputedStyle(parentOf(element)).fontFamily);
    }
  });

  it("sets each part's text in the colour of the box around it", () => {
    mount();
    const parts: [string, HTMLElement][] = [
      ["ghost Button", roleNamed("button", "Ghost")],
      ["outline Button", roleNamed("button", "Outline")],
      ["active Pagination link", part("pagination-link", "a", 0)],
      ["Pagination link", part("pagination-link", "a", 1)],
      ["Breadcrumb link", part("breadcrumb-link", "a")],
      ["Collapsible trigger", part("collapsible-trigger", "button")],
      ["Combobox trigger", part("combobox-trigger", "button")],
      ["Item button", part("item", "button")],
      ["Item link", part("item", "a")],
      ["Sidebar row button", part("sidebar-menu-button", "button")],
      ["Sidebar row link", part("sidebar-menu-button", "a")],
    ];
    for (const [name, element] of parts) {
      expect.soft(getComputedStyle(element).color, name).toBe(getComputedStyle(parentOf(element)).color);
    }
  });

  it("underlines no link at rest", () => {
    mount();
    const links: [string, HTMLElement][] = [
      ["Breadcrumb link", part("breadcrumb-link", "a")],
      ["active Pagination link", part("pagination-link", "a", 0)],
      ["Pagination link", part("pagination-link", "a", 1)],
      ["Pagination next", part("pagination-next", "a")],
      ["Item link", part("item", "a")],
      ["Attachment link trigger", part("attachment-trigger", "a")],
      ["Sidebar row link", part("sidebar-menu-button", "a")],
      ["Sidebar sub-row link", part("sidebar-menu-sub-button", "a")],
      ["Link", roleNamed("link", "Terms of delivery")],
    ];
    for (const [name, element] of links) {
      expect.soft(getComputedStyle(element).textDecorationLine, name).toBe("none");
    }
  });

  it("sets the text fields in the font of the box around them", () => {
    mount();
    for (const [name, element] of [
      ["Input", part("input", "input")],
      ["Textarea", part("textarea", "textarea")],
    ] as const) {
      expect
        .soft(getComputedStyle(element).fontFamily, name)
        .toBe(getComputedStyle(parentOf(element)).fontFamily);
    }
  });

  it("sets an Accordion trigger in its item's type, under a header with no heading margin", () => {
    // Base UI renders Accordion.Header as an `h3`. Oracle: under preflight the heading keeps no
    // size, weight or margin of its own, so the trigger reads its item's.
    mount();
    const item = part("accordion-item", "div");
    const header = part("accordion-header", "h3");
    const trigger = part("accordion-trigger", "button");
    expect.soft(getComputedStyle(trigger).fontSize).toBe(getComputedStyle(item).fontSize);
    expect.soft(getComputedStyle(header).marginBlockStart).toBe("0px");
    expect.soft(getComputedStyle(header).marginBlockEnd).toBe("0px");
  });

  it("draws no border or padding on the buttons that set neither", () => {
    mount();
    const parts: [string, HTMLElement][] = [
      ["Toggle", part("toggle", "button")],
      ["Collapsible trigger", part("collapsible-trigger", "button")],
      ["Accordion trigger", part("accordion-trigger", "button")],
      ["Combobox trigger", part("combobox-trigger", "button")],
      ["Sidebar rail", part("sidebar-rail", "button")],
    ];
    for (const [name, element] of parts) {
      const style = getComputedStyle(element);
      expect.soft(style.borderTopWidth, name).toBe("0px");
      expect.soft(style.borderBottomWidth, name).toBe("0px");
      expect.soft(style.paddingTop, name).toBe("0px");
      expect.soft(style.paddingBottom, name).toBe("0px");
    }
  });

  it("marks no list and indents none by the browser's list inset", () => {
    mount();
    const lists: [string, HTMLElement][] = [
      ["Breadcrumb list", part("breadcrumb-list", "ol")],
      ["Pagination content", part("pagination-content", "ul")],
      ["Sidebar menu", part("sidebar-menu", "ul")],
    ];
    for (const [name, element] of lists) {
      const style = getComputedStyle(element);
      expect.soft(style.listStyleType, name).toBe("none");
      expect.soft(style.paddingInlineStart, name).toBe("0px");
      expect.soft(style.marginBlockStart, name).toBe("0px");
    }
    expect(getComputedStyle(part("sidebar-menu-sub", "ul")).listStyleType, "Sidebar sub-menu").toBe("none");
  });
});
