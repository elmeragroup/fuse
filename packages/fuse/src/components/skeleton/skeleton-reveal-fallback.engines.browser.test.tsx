/**
 * Unit under test: the stylesheet's first-paint fallback, what server HTML shows before hydration
 * measures the bones. Oracle: the screen itself. The sample embeds an iframe and an image that
 * paint pure red, so any red pixel in a screenshot of the skeleton is embedded content showing
 * through; their placeholders must paint the muted role, read off a swatch, where it would be.
 */
import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { wait } from "../../../test/animation-frames";
import { failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { fkasPrivate } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

const RED_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='red'/%3E%3C/svg%3E";

/** The server HTML of a loading reveal whose sample embeds red media. */
function serverMarkup(): string {
  const reveal = createElement(SkeletonReveal, {
    loading: true,
    label: "Henter",
    children: createElement(
      "div",
      { className: "flex w-72 flex-col gap-2 p-2" },
      createElement("p", null, "Planned maintenance"),
      createElement("iframe", {
        title: "Map",
        srcDoc: "<body style='margin:0;background:rgb(255,0,0)'></body>",
        className: "h-20 w-40 border-0",
      }),
      createElement("img", { alt: "", src: RED_SVG, className: "size-16" }),
      createElement("p", { "data-skeleton": "ignore", "data-probe": "ignored-text" }, "Ignored note"),
      createElement("input", {
        "aria-label": "Ignored",
        "data-skeleton": "ignore",
        "data-probe": "ignored-input",
      }),
      createElement("img", {
        alt: "",
        src: RED_SVG,
        className: "size-8",
        "data-skeleton": "ignore",
        "data-probe": "ignored-media",
      }),
      createElement(
        "div",
        { "data-skeleton": "ignore" },
        createElement("span", { "data-probe": "ignored-leaf" }, "Ignored leaf"),
        createElement("img", {
          alt: "",
          src: RED_SVG,
          className: "size-8",
          "data-probe": "ignored-nested-media",
        })
      )
    ),
  });
  return renderToStaticMarkup(createElement(ThemeScope, { theme: fkasPrivate }, reveal));
}

/** The RGBA pixels of a screenshot of `element`, and its size. */
async function screenshotPixels(element: HTMLElement): Promise<{ data: Uint8ClampedArray; width: number }> {
  const base64 = await page.screenshot({ save: false, element });
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("expected a 2d context");
  context.drawImage(image, 0, 0);
  return { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width };
}

let host: HTMLElement | undefined;
afterEach(() => host?.remove());

describe("SkeletonReveal first paint", () => {
  it("covers embedded and replaced media with their placeholders before the bones are measured", async () => {
    host = document.createElement("div");
    host.innerHTML = serverMarkup();
    document.body.append(host);
    // The iframe's document loads, as it would before hydration.
    await wait(400);
    // DOM audit: server HTML, unhydrated: the skeleton pane has no role.
    const skeleton = host.querySelector('[data-slot="skeleton-reveal-skeleton"]');
    if (!(skeleton instanceof HTMLElement)) throw new Error("expected the skeleton pane");
    expect(skeleton.hasAttribute("data-measured")).toBe(false);

    const { data, width } = await screenshotPixels(skeleton);
    let red = 0;
    for (let index = 0; index < data.length; index += 4) {
      if ((data[index] ?? 0) > 200 && (data[index + 1] ?? 255) < 60 && (data[index + 2] ?? 255) < 60)
        red += 1;
    }
    expect(red).toBe(0);

    // The centre of each medium shows its placeholder, one colour for both.
    const origin = skeleton.getBoundingClientRect();
    const scale = width / origin.width;
    const centre = (element: Element | null): string => {
      if (element === null) throw new Error("expected the medium");
      const rect = element.getBoundingClientRect();
      const x = Math.round((rect.left - origin.left + rect.width / 2) * scale);
      const y = Math.round((rect.top - origin.top + rect.height / 2) * scale);
      const index = (y * width + x) * 4;
      return [data[index], data[index + 1], data[index + 2]].join(",");
    };
    // DOM audit: the media are located by tag in unhydrated HTML.
    const frame = centre(skeleton.querySelector("iframe"));
    expect(centre(skeleton.querySelector("img"))).toBe(frame);

    // Oracle swatch beside the skeleton, in the same theme scope, painted with the muted role. Red
    // never showing proves the placeholder covers the content; matching the swatch proves it is
    // the placeholder doing so. The page itself can be the same tone in a theme, so it is no oracle.
    const swatch = async (background: string): Promise<string> => {
      const probe = document.createElement("div");
      Object.assign(probe.style, { width: "16px", height: "16px", background });
      skeleton.parentElement?.append(probe);
      const pixels = await screenshotPixels(probe);
      probe.remove();
      const index =
        (Math.floor(pixels.data.length / 4 / pixels.width / 2) * pixels.width +
          Math.floor(pixels.width / 2)) *
        4;
      return [pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]].join(",");
    };
    expect(frame).toBe(await swatch("var(--muted)"));

    // An ignored subtree paints nothing at all before measuring, as the measuring skips it after.
    for (const probe of [
      "ignored-text",
      "ignored-input",
      "ignored-media",
      "ignored-leaf",
      "ignored-nested-media",
    ]) {
      // DOM audit: the probes mark consumer markup the reveal ignores.
      const element = skeleton.querySelector(`[data-probe="${probe}"]`);
      if (element === null) throw new Error(`expected ${probe}`);
      expect(getComputedStyle(element).visibility, probe).toBe("hidden");
    }
  });

  it("strikes through text right inside the reveal before the bones are measured", async () => {
    host = document.createElement("div");
    // Bare text as the stand-in: its only boxes are the pane's, as the ghost has none of its own.
    host.innerHTML = renderToStaticMarkup(
      createElement(
        ThemeScope,
        { theme: fkasPrivate },
        createElement(SkeletonReveal, { loading: true, label: "Henter", children: "Planned maintenance" })
      )
    );
    document.body.append(host);
    await wait(100);
    // DOM audit: server HTML, unhydrated: the skeleton pane has no role.
    const skeleton = host.querySelector('[data-slot="skeleton-reveal-skeleton"]');
    if (!(skeleton instanceof HTMLElement)) throw new Error("expected the skeleton pane");
    expect(skeleton.hasAttribute("data-measured")).toBe(false);

    // Oracle swatch beside the skeleton, in the same theme scope, painted with the muted role.
    const probe = document.createElement("div");
    Object.assign(probe.style, { width: "16px", height: "16px", background: "var(--muted)" });
    skeleton.parentElement?.append(probe);
    const swatch = await screenshotPixels(probe);
    probe.remove();
    const middle = (Math.floor(swatch.data.length / 4 / swatch.width / 2) * swatch.width + 8) * 4;
    const muted = [swatch.data[middle], swatch.data[middle + 1], swatch.data[middle + 2]].join(",");

    // The text's glyphs are transparent; the strike-through is a muted bar most of a line wide.
    const { data } = await screenshotPixels(skeleton);
    let bar = 0;
    for (let index = 0; index < data.length; index += 4) {
      if ([data[index], data[index + 1], data[index + 2]].join(",") === muted) bar += 1;
    }
    expect(bar).toBeGreaterThan(200);
  });
});
