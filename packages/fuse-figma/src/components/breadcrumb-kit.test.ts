/**
 * Unit under test: the four Breadcrumb component sets as the build produces them. Oracle: the Fuse
 * variable or literal each Figma field of a cell must carry, read by hand from `breadcrumb.tsx`,
 * `breadcrumb-variants.ts` and the shared self focus ring in `styles/utils.ts`, and from the docs
 * Basic and Ellipsis demos. Every part sits in `Breadcrumb.List`, whose `text-sm` sets the 14/20px
 * type and whose `text-muted-foreground` sets the text color each part inherits, below the page's
 * `font-sans`. The link turns `foreground` on hover through `hover:text-foreground` and rings on
 * focus, the page sets its own `text-foreground` and `font-normal`, the separator sizes its default
 * CaretRight to 14px through `[&>svg]:size-3.5`, and the ellipsis centers DotsThree at 16px in its
 * `size-5` box.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  CENTERED_BOX,
  fixedSize,
  FOCUS_RING,
  HUG,
  HUGGING_LABEL,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

function set(key: string) {
  return spec.componentSets.find((candidate) => candidate.key === key);
}

/** A part's text in the list's 14/20px type at the page's Regular weight. */
const text = (characters: string, color: string) =>
  ({
    kind: "text",
    key: "label",
    name: "label",
    characters,
    textProperty: "Label",
    fontFamily: token("font-sans"),
    fontStyle: "Regular",
    fontSize: literal(14),
    lineHeight: literal(20),
    color: paint(color),
    ...HUGGING_LABEL,
  }) as const;

/** A part that hugs what it holds, with no fill, stroke or corner. */
const hugging = (name: string, children: readonly unknown[]) => ({
  name,
  ...CENTERED_BOX,
  sizing: { horizontal: HUG, vertical: HUG },
  clips: true,
  cornerRadius: literal(0),
  children,
});

/** A fixed icon in the list's muted text color. */
const icon = (key: string, name: string, glyph: string, size: number) =>
  ({
    kind: "icon",
    key,
    name,
    icon: `icon/${glyph}`,
    swapProperty: undefined,
    size: literal(size),
    color: paint("muted-foreground"),
  }) as const;

describe("the Breadcrumb link component set", () => {
  it("holds 3 states on the Breadcrumb page, with columns by state and the demo's first link", () => {
    const links = set("breadcrumb-link");
    expect([links?.name, links?.page]).toEqual(["Breadcrumb link", "page/breadcrumb"]);
    expect(links?.axes).toEqual([{ name: "state", values: ["rest", "hover", "focus"] }]);
    expect(links?.columnAxis).toBe("state");
    expect(links?.textProperties).toEqual([{ name: "Label", defaultValue: "Home" }]);
    expect(links?.swapProperties).toEqual([]);
  });

  it("draws a resting link as its text alone, in the list's muted 14/20px type", () => {
    expect(variantRoot(spec, "breadcrumb-link/state=rest")).toEqual(
      hugging("breadcrumb-link", [text("Home", "muted-foreground")])
    );
  });

  it("turns the text foreground on hover and keeps the box", () => {
    expect(variantRoot(spec, "breadcrumb-link/state=hover")).toEqual(
      hugging("breadcrumb-link", [text("Home", "foreground")])
    );
  });

  it("rings a focused link with the 2px ring and keeps the muted text", () => {
    expect(variantRoot(spec, "breadcrumb-link/state=focus")).toEqual({
      ...hugging("breadcrumb-link", [text("Home", "muted-foreground")]),
      shadows: [FOCUS_RING],
    });
  });
});

describe("the Breadcrumb page component set", () => {
  it("holds one variant under a one-value current property, with the demo's page", () => {
    const pages = set("breadcrumb-page");
    expect([pages?.name, pages?.page]).toEqual(["Breadcrumb page", "page/breadcrumb"]);
    expect(pages?.axes).toEqual([{ name: "current", values: ["page"] }]);
    expect(pages?.columnAxis).toBe("current");
    expect(pages?.textProperties).toEqual([{ name: "Label", defaultValue: "Breadcrumb" }]);
    expect(pages?.swapProperties).toEqual([]);
  });

  it("draws the current page in foreground over the list's muted text", () => {
    expect(variantRoot(spec, "breadcrumb-page/current=page")).toEqual(
      hugging("breadcrumb-page", [text("Breadcrumb", "foreground")])
    );
  });
});

describe("the Breadcrumb ellipsis component set", () => {
  it("holds one variant under a one-value size property", () => {
    const ellipses = set("breadcrumb-ellipsis");
    expect([ellipses?.name, ellipses?.page]).toEqual(["Breadcrumb ellipsis", "page/breadcrumb"]);
    expect(ellipses?.axes).toEqual([{ name: "size", values: ["20"] }]);
    expect(ellipses?.columnAxis).toBe("size");
    expect([ellipses?.textProperties, ellipses?.swapProperties]).toEqual([[], []]);
  });

  it("centers the 16px DotsThree in the 20px box, in the list's muted text, and draws no text", () => {
    expect(variantRoot(spec, "breadcrumb-ellipsis/size=20")).toEqual({
      ...hugging("breadcrumb-ellipsis", [icon("icon", "Icon", "DotsThree", 16)]),
      sizing: fixedSize(literal(20), literal(20)),
    });
  });
});

describe("the Breadcrumb separator component set", () => {
  it("holds one variant under a one-value size property", () => {
    const separators = set("breadcrumb-separator");
    expect([separators?.name, separators?.page]).toEqual(["Breadcrumb separator", "page/breadcrumb"]);
    expect(separators?.axes).toEqual([{ name: "size", values: ["14"] }]);
    expect(separators?.columnAxis).toBe("size");
    expect([separators?.textProperties, separators?.swapProperties]).toEqual([[], []]);
  });

  it("hugs the default CaretRight at 14px, in the list's muted text", () => {
    expect(variantRoot(spec, "breadcrumb-separator/size=14")).toEqual(
      hugging("breadcrumb-separator", [icon("caret", "Caret", "CaretRight", 14)])
    );
  });
});
