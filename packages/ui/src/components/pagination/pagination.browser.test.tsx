import { useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Pagination } from "./pagination";

const LANDMARK_COPY = {
  "nb-NO": "Sidenavigasjon",
  "sv-SE": "Sidnavigering",
  "en-US": "Pagination",
  "fi-FI": "Sivutus",
} as const;

const PREVIOUS_COPY = {
  "nb-NO": "Forrige",
  "sv-SE": "Föregående",
  "en-US": "Previous",
  "fi-FI": "Edellinen",
} as const;

const NEXT_COPY = {
  "nb-NO": "Neste",
  "sv-SE": "Nästa",
  "en-US": "Next",
  "fi-FI": "Seuraava",
} as const;

const GO_TO_PREVIOUS_COPY = {
  "nb-NO": "Gå til forrige side",
  "sv-SE": "Gå till föregående sida",
  "en-US": "Go to previous page",
  "fi-FI": "Siirry edelliselle sivulle",
} as const;

const GO_TO_NEXT_COPY = {
  "nb-NO": "Gå til neste side",
  "sv-SE": "Gå till nästa sida",
  "en-US": "Go to next page",
  "fi-FI": "Siirry seuraavalle sivulle",
} as const;

const MORE_PAGES_COPY = {
  "nb-NO": "Flere sider",
  "sv-SE": "Fler sidor",
  "en-US": "More pages",
  "fi-FI": "Lisää sivuja",
} as const;

function renderPagination(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function BasicPages() {
  return (
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
          <Pagination.Ellipsis />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next href="#next" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination.Root>
  );
}

describe("Pagination", () => {
  it("is a navigation landmark named Pagination in en-US, with page links by name", () => {
    renderPagination(<BasicPages />);
    expect(roleNamed("navigation", "Pagination").getAttribute("data-slot")).toBe("pagination");
    expect(roleNamed("link", "1").getAttribute("href")).toBe("#1");
    expect(roleNamed("link", "2").getAttribute("href")).toBe("#2");
    expect(roleNamed("link", "Go to previous page").getAttribute("data-slot")).toBe("pagination-previous");
    expect(roleNamed("link", "Go to next page").getAttribute("data-slot")).toBe("pagination-next");
  });

  it("exposes aria-current=page only on the active link, never false", () => {
    renderPagination(<BasicPages />);
    expect(roleNamed("link", "1").getAttribute("aria-current")).toBe("page");
    expect(roleNamed("link", "2").hasAttribute("aria-current")).toBe(false);
    expect(roleNamed("link", "2").getAttribute("aria-current")).toBeNull();
    expect(roleNamed("link", "Go to previous page").hasAttribute("aria-current")).toBe(false);
  });

  it("lets an explicit aria-label win over the label prop and the dictionary", () => {
    const { unmount: unmountDefault } = renderPagination(<BasicPages />);
    expect(roleNamed("navigation", "Pagination")).toBeTruthy();
    unmountDefault();

    const { unmount: unmountLabel } = renderPagination(
      <Pagination.Root label="Pages">
        <Pagination.Content />
      </Pagination.Root>
    );
    expect(roleNamed("navigation", "Pages")).toBeTruthy();
    expect(page.getByRole("navigation", { name: "Pagination", exact: true }).query()).toBeNull();
    unmountLabel();

    renderPagination(
      <Pagination.Root label="Pages" aria-label="Invoice pages">
        <Pagination.Content />
      </Pagination.Root>
    );
    expect(roleNamed("navigation", "Invoice pages")).toBeTruthy();
    expect(page.getByRole("navigation", { name: "Pages", exact: true }).query()).toBeNull();
    expect(page.getByRole("navigation", { name: "Pagination", exact: true }).query()).toBeNull();
  });

  it("resolves landmark, Previous/Next, and ellipsis copy in every locale and lets overrides win", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderPagination(<BasicPages />, locale);
      expect(roleNamed("navigation", LANDMARK_COPY[locale]), locale).toBeTruthy();
      const previous = roleNamed("link", GO_TO_PREVIOUS_COPY[locale]);
      const next = roleNamed("link", GO_TO_NEXT_COPY[locale]);
      expect(previous.textContent, locale).toContain(PREVIOUS_COPY[locale]);
      expect(next.textContent, locale).toContain(NEXT_COPY[locale]);
      expect(page.getByText(MORE_PAGES_COPY[locale], { exact: true }).element(), locale).toBeTruthy();
      unmount();
    }

    renderPagination(
      <Pagination.Root>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous href="#previous" text="Back" label="Earlier page" />
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Next href="#next" text="Forward" aria-label="Later page" />
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Ellipsis label="Hidden pages" />
          </Pagination.Item>
        </Pagination.Content>
      </Pagination.Root>,
      "nb-NO"
    );
    expect(roleNamed("link", "Earlier page").textContent).toContain("Back");
    expect(roleNamed("link", "Later page").textContent).toContain("Forward");
    expect(page.getByRole("link", { name: "Gå til forrige side", exact: true }).query()).toBeNull();
    expect(page.getByRole("link", { name: "Gå til neste side", exact: true }).query()).toBeNull();
    expect(page.getByText("Hidden pages", { exact: true }).element()).toBeTruthy();
    expect(page.getByText("Flere sider", { exact: true }).query()).toBeNull();
  });

  it("hides only the ellipsis icon and keeps morePages in the accessibility tree", () => {
    renderPagination(<BasicPages />);
    const sr = page.getByText("More pages", { exact: true }).element();
    if (!(sr instanceof HTMLElement)) {
      throw new Error("expected morePages copy");
    }
    const ellipsis = sr.parentElement;
    if (!(ellipsis instanceof HTMLElement)) {
      throw new Error("expected pagination ellipsis");
    }
    const icon = ellipsis.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(ellipsis.getAttribute("aria-hidden")).toBeNull();
    expect(ellipsis.getAttribute("data-slot")).toBe("pagination-ellipsis");
  });

  it("maps isActive onto the outline button variant and leaves others ghost", () => {
    renderPagination(<BasicPages />);
    const active = roleNamed("link", "1");
    const inactive = roleNamed("link", "2");
    expect(active.getAttribute("data-slot")).toBe("pagination-link");
    expect(inactive.getAttribute("data-slot")).toBe("pagination-link");
    expect(getComputedStyle(active).borderTopColor).not.toBe(getComputedStyle(inactive).borderTopColor);
    expect(getComputedStyle(active).boxShadow).not.toBe(getComputedStyle(inactive).boxShadow);
  });

  it("keeps every link inside the navigation when the row has to wrap", () => {
    renderPagination(
      <div style={{ width: 200 }}>
        <BasicPages />
      </div>
    );
    const navigation = roleNamed("navigation", "Pagination");
    const bounds = navigation.getBoundingClientRect();
    const links = page
      .getByRole("link")
      .elements()
      .filter((element): element is HTMLElement => element instanceof HTMLElement);
    // Previous, both page links and Next; the ellipsis is not a link.
    expect(links).toHaveLength(4);
    for (const link of links) {
      const rect = link.getBoundingClientRect();
      expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
    }
  });

  it("moves aria-current with a controlled next-page click", async () => {
    function Controlled() {
      const [current, setCurrent] = useState(2);
      return (
        <Pagination.Root>
          <Pagination.Content>
            {[1, 2, 3].map((number) => (
              <Pagination.Item key={number}>
                <Pagination.Link
                  href={`#page-${String(number)}`}
                  isActive={number === current}
                  onClick={(event) => {
                    event.preventDefault();
                    setCurrent(number);
                  }}>
                  {number}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next
                href="#next"
                onClick={(event) => {
                  event.preventDefault();
                  setCurrent((page_) => Math.min(3, page_ + 1));
                }}
              />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination.Root>
      );
    }
    renderPagination(<Controlled />);
    expect(roleNamed("link", "2").getAttribute("aria-current")).toBe("page");

    await userEvent.click(roleNamed("link", "Go to next page"));
    await expect.poll(() => roleNamed("link", "3").getAttribute("aria-current")).toBe("page");
    expect(roleNamed("link", "2").getAttribute("aria-current")).toBeNull();
  });
});
