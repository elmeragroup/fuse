/**
 * Unit under test: SkeletonReveal's server HTML, what a reader gets before hydration. Oracle: the
 * accessibility and form contract, read off the parsed markup rather than its spelling: a busy
 * root with its label, a skeleton hidden from assistive tech and inert, ghost controls in a
 * disabled fieldset, no bones measured yet, and content only once there is data. Presentation is
 * the browser tests'.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { fkasPrivate } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

type Invoice = { readonly number: string };

/**
 * Server-renders a tree inside the theme scope every suite shares, as a host's page would emit
 * it, and parses the HTML into a document without running or hydrating anything in it.
 */
function serverDocument(tree: ReactElement): Document {
  const markup = renderToStaticMarkup(createElement(ThemeScope, { theme: fkasPrivate }, tree));
  return new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
}

function invoiceDocument(data: Invoice | null): Document {
  return serverDocument(
    createElement(SkeletonReveal<Invoice>, {
      data,
      sample: { number: "Invoice 0000" },
      label: "Henter faktura",
      children: (invoice: Invoice) =>
        createElement(
          "label",
          null,
          invoice.number,
          createElement("input", { name: "invoice", required: true })
        ),
    })
  );
}

/** The reveal's parts have no role in unhydrated markup; locate them by data-slot. */
function part(document: Document, slot: string): Element | null {
  return document.querySelector(`[data-slot="${slot}"]`);
}

describe("SkeletonReveal server markup", () => {
  it("is busy and labelled, with an inert skeleton hidden from assistive tech and no bones yet", () => {
    const document = invoiceDocument(null);
    expect(part(document, "skeleton-reveal")?.getAttribute("aria-busy")).toBe("true");
    expect(part(document, "skeleton-reveal-label")?.textContent).toBe("Henter faktura");
    const skeleton = part(document, "skeleton-reveal-skeleton");
    expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton?.hasAttribute("inert")).toBe(true);
    // Not measured: the stylesheet's first-paint fallback applies until the client draws bones.
    expect(skeleton?.hasAttribute("data-measured")).toBe(false);
    expect(part(document, "skeleton-reveal-bones")?.children).toHaveLength(0);
    expect(part(document, "skeleton-reveal-ghost")?.textContent).toBe("Invoice 0000");
    expect(part(document, "skeleton-reveal-content")).toBeNull();
  });

  it("defaults the label to the locale dictionary", () => {
    const label = (locale: "nb-NO" | "en-US"): string | null | undefined =>
      part(
        serverDocument(
          createElement(LocaleProvider, {
            locale,
            children: createElement(SkeletonReveal, {
              loading: true,
              children: createElement("p", null, "Sum"),
            }),
          })
        ),
        "skeleton-reveal-label"
      )?.textContent;
    expect([label("nb-NO"), label("en-US")]).toEqual(["Laster", "Loading"]);
  });
});

describe("SkeletonReveal server markup", () => {
  it("keeps the ghost's controls out of their form from the first paint", () => {
    const document = invoiceDocument(null);
    const input = part(document, "skeleton-reveal-ghost")?.querySelector("input");
    expect(input?.closest("fieldset")?.disabled).toBe(true);
    expect(input?.matches(":disabled")).toBe(true);
  });

  it("renders data as enabled content, not busy, with no label or skeleton", () => {
    const document = invoiceDocument({ number: "Invoice 4711" });
    expect(part(document, "skeleton-reveal")?.getAttribute("aria-busy")).toBe("false");
    const content = part(document, "skeleton-reveal-content");
    expect(content?.textContent).toBe("Invoice 4711");
    expect(content?.querySelector("input")?.matches(":disabled")).toBe(false);
    expect(part(document, "skeleton-reveal-label")).toBeNull();
    expect(part(document, "skeleton-reveal-skeleton")).toBeNull();
  });
});
