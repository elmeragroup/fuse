import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { Breadcrumb } from "./breadcrumb";

const LANDMARK_COPY = {
  "nb-NO": "Brødsmuler",
  "sv-SE": "Brödsmulor",
  "en-US": "Breadcrumb",
  "fi-FI": "Murupolku",
} as const;

const MORE_COPY = {
  "nb-NO": "Mer",
  "sv-SE": "Mer",
  "en-US": "More",
  "fi-FI": "Lisää",
} as const;

function renderBreadcrumb(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function navNamed(name: string): HTMLElement {
  const element = page.getByRole("navigation", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected navigation ${name}`);
  }
  return element;
}

function linkNamed(name: string): HTMLElement {
  const element = page.getByRole("link", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected link ${name}`);
  }
  return element;
}

function BasicTrail() {
  return (
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="#home">Home</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="#orders">Orders</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>Invoice 1042</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );
}

describe("Breadcrumb", () => {
  it("is a navigation landmark named Breadcrumb in en-US, with links by name", () => {
    renderBreadcrumb(<BasicTrail />);
    expect(navNamed("Breadcrumb").getAttribute("data-slot")).toBe("breadcrumb");
    expect(linkNamed("Home").getAttribute("href")).toBe("#home");
    expect(linkNamed("Orders").getAttribute("href")).toBe("#orders");
  });

  it("exposes the current page as a disabled current link and keeps it off the tab order", () => {
    renderBreadcrumb(<BasicTrail />);
    const current = page.getByRole("link", { name: "Invoice 1042", exact: true }).element();
    if (!(current instanceof HTMLElement)) {
      throw new Error("expected current page");
    }
    expect(current.tagName).toBe("SPAN");
    expect(current.getAttribute("aria-disabled")).toBe("true");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.getAttribute("data-slot")).toBe("breadcrumb-page");
    expect(current.getAttribute("href")).toBeNull();
    expect(current.tabIndex).toBeLessThan(0);
  });

  it("keeps merged className and data-slot on a custom Link render element", () => {
    renderBreadcrumb(
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link className="text-primary" render={<a href="#home" />}>
              Home
            </Breadcrumb.Link>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    );
    const link = linkNamed("Home");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#home");
    expect(link.getAttribute("data-slot")).toBe("breadcrumb-link");
    expect(getComputedStyle(link).color).toBe(cssVarColor(link, "--primary"));
  });

  it("hides separators from the accessibility tree and keeps ellipsis more in it", () => {
    renderBreadcrumb(
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="#home">Home</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Ellipsis />
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>Invoice 1042</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    );
    const nav = navNamed("Breadcrumb");
    const list = nav.querySelector("ol");
    if (!(list instanceof HTMLOListElement)) {
      throw new Error("expected ol");
    }
    const separators = [...list.children].filter((child) => child.getAttribute("role") === "presentation");
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator.getAttribute("aria-hidden")).toBe("true");
    }
    expect(page.getByRole("listitem").elements()).toHaveLength(3);
    const more = page.getByText("More", { exact: true }).element();
    if (!(more instanceof HTMLElement)) {
      throw new Error("expected ellipsis more copy");
    }
    const ellipsis = more.parentElement;
    if (!(ellipsis instanceof HTMLElement)) {
      throw new Error("expected breadcrumb ellipsis");
    }
    const icon = ellipsis.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(ellipsis.getAttribute("aria-hidden")).toBeNull();
  });

  it("renders an ordered list with one li per item plus separators", () => {
    renderBreadcrumb(<BasicTrail />);
    const nav = navNamed("Breadcrumb");
    const list = nav.querySelector("ol");
    if (!(list instanceof HTMLOListElement)) {
      throw new Error("expected ol");
    }
    expect(list.getAttribute("data-slot")).toBe("breadcrumb-list");
    const items = [...list.children];
    expect(items.map((child) => child.tagName)).toEqual(["LI", "LI", "LI", "LI", "LI"]);
    expect(items.map((child) => child.getAttribute("data-slot"))).toEqual([
      "breadcrumb-item",
      "breadcrumb-separator",
      "breadcrumb-item",
      "breadcrumb-separator",
      "breadcrumb-item",
    ]);
  });

  it("lets an explicit aria-label win over the label prop and the dictionary", () => {
    const { unmount: unmountDefault } = renderBreadcrumb(<BasicTrail />);
    expect(navNamed("Breadcrumb")).toBeTruthy();
    unmountDefault();

    const { unmount: unmountLabel } = renderBreadcrumb(
      <Breadcrumb.Root label="Trail">
        <Breadcrumb.List />
      </Breadcrumb.Root>
    );
    expect(navNamed("Trail")).toBeTruthy();
    expect(page.getByRole("navigation", { name: "Breadcrumb", exact: true }).query()).toBeNull();
    unmountLabel();

    renderBreadcrumb(
      <Breadcrumb.Root label="Trail" aria-label="Invoice trail">
        <Breadcrumb.List />
      </Breadcrumb.Root>
    );
    expect(navNamed("Invoice trail")).toBeTruthy();
    expect(page.getByRole("navigation", { name: "Trail", exact: true }).query()).toBeNull();
    expect(page.getByRole("navigation", { name: "Breadcrumb", exact: true }).query()).toBeNull();
  });

  it("resolves landmark and more copy in every locale and lets overrides win", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderBreadcrumb(
        <Breadcrumb.Root>
          <Breadcrumb.List>
            <Breadcrumb.Item>
              <Breadcrumb.Ellipsis />
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb.Root>,
        locale
      );
      expect(navNamed(LANDMARK_COPY[locale]), locale).toBeTruthy();
      expect(page.getByText(MORE_COPY[locale], { exact: true }).element(), locale).toBeTruthy();
      unmount();
    }

    renderBreadcrumb(
      <Breadcrumb.Root label="Trail">
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Ellipsis label="Hidden crumbs" />
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>,
      "nb-NO"
    );
    expect(navNamed("Trail")).toBeTruthy();
    expect(page.getByRole("navigation", { name: "Brødsmuler", exact: true }).query()).toBeNull();
    expect(page.getByText("Hidden crumbs", { exact: true }).element()).toBeTruthy();
    expect(page.getByText("Mer", { exact: true }).query()).toBeNull();
  });

  it("lets children replace the default separator glyph", () => {
    renderBreadcrumb(
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="#home">Home</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator>/</Breadcrumb.Separator>
          <Breadcrumb.Item>
            <Breadcrumb.Page>Orders</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    );
    const slash = page.getByText("/", { exact: true }).element();
    expect(slash.getAttribute("role")).toBe("presentation");
    expect(slash.querySelector("svg")).toBeNull();
  });

  it("paints the shared focus ring on keyboard focus of Link", async () => {
    renderBreadcrumb(
      <>
        <a href="#before">Before</a>
        <BasicTrail />
      </>
    );
    const previous = linkNamed("Before");
    const home = linkNamed("Home");
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, home);
  });
});
