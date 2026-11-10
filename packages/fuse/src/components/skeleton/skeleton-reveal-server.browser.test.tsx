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

/**
 * Server-renders a tree inside the theme scope every suite shares, as a host's page would emit
 * it, and parses the HTML into a document without running or hydrating anything in it.
 */
function serverDocument(tree: ReactElement): Document {
  const markup = renderToStaticMarkup(createElement(ThemeScope, { theme: fkasPrivate }, tree));
  return new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
}

/** The reveal's parts have no role in unhydrated markup; locate them by data-slot. */
function part(document: Document, slot: string): Element | null {
  return document.querySelector(`[data-slot="${slot}"]`);
}

describe("SkeletonReveal server markup", () => {
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
