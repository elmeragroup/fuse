/**
 * Unit under test: the Link component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `components/link/link-variants.ts`,
 * the shared self focus ring in `styles/utils.ts`, the classes Tailwind compiles them to, and the
 * docs React Aria demo, whose link reads `invoice 1042`. Link sets no type size, so its text takes
 * the host page's: the browser's 16px `medium` and preflight's `line-height: 1.5` on `<html>`. The
 * `default` variant's `text-inherit` takes the page's `foreground`. At 16px the underline sits
 * `0.2em` = 3.2px below the text and is `max(1px, 0.0625em)` = 1px thick. An `always` underline
 * rests in the role tint `<color>/35` of the link's text color, the light arm of its `light-dark()`
 * (see `readDecorationColor` in `label-layout.ts`). Its hover, `enabled-hover:decoration-current`,
 * draws it in the text's own color, Figma's `AUTO`, at the same 1px. `enabled-hover:underline` draws
 * a `hover` link's underline in the text's color, `enabled-hover:opacity-80` fades a `none` link to
 * 80%, and keyboard focus draws `ring-2 ring-ring`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  CENTERED_BOX,
  FOCUS_RING,
  HUG,
  HUGGING_LABEL,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

/** Each variant the set draws and the color its text takes. */
const COLORS = {
  default: "foreground",
  foreground: "foreground",
  primary: "primary",
  brand: "brand",
  muted: "muted-foreground",
  error: "error",
} as const;

const UNDERLINES = ["always", "hover", "none"];

const STATES = ["rest", "hover", "focus"];

/** An underline at 16px, 3.2px below the text and 1px thick, in the text's own color. */
const LINE = { offset: 3.2, thickness: 1, color: undefined };

/** An always link's resting underline: the tint of its text color at the light scheme's 35%. */
function dimmed(color: string) {
  return { ...LINE, color: paint(`${color}/35`) };
}

/**
 * A link: its text in the host's 16/24px type, in a box that hugs it with no fill or corner.
 * `toEqual` reads an undefined `underline` as the field left out, as a cell with no underline has it.
 */
function link(color: string, underline: typeof LINE | ReturnType<typeof dimmed> | undefined) {
  return {
    name: "link",
    ...CENTERED_BOX,
    sizing: { horizontal: HUG, vertical: HUG },
    clips: true,
    cornerRadius: literal(0),
    children: [
      {
        kind: "text",
        key: "label",
        name: "label",
        characters: "invoice 1042",
        textProperty: "Label",
        fontFamily: token("font-sans"),
        fontStyle: "Regular",
        fontSize: literal(16),
        lineHeight: literal(24),
        color: paint(color),
        underline,
        ...HUGGING_LABEL,
      },
    ],
  };
}

function cell(variant: string, underline: string, state: string) {
  return variantRoot(spec, `link/variant=${variant},underline=${underline},state=${state}`);
}

describe("the Link component set", () => {
  it("holds 6 variants × 3 underlines × 3 states on the Link page, with columns by state and the demo's text", () => {
    const links = spec.componentSets.find((candidate) => candidate.key === "link");
    expect([links?.name, links?.page]).toEqual(["Link", "page/link"]);
    expect(links?.axes).toEqual([
      { name: "variant", values: Object.keys(COLORS) },
      { name: "underline", values: UNDERLINES },
      { name: "state", values: STATES },
    ]);
    expect(links?.columnAxis).toBe("state");
    expect(new Set(links?.variants.map((variant) => variant.key)).size).toBe(54);
    expect(links?.textProperties).toEqual([{ name: "Label", defaultValue: "invoice 1042" }]);
    expect(links?.swapProperties).toEqual([]);
  });

  it("dims an always link's underline to its color's 35% tint at rest, and draws it full on hover", () => {
    for (const [variant, color] of Object.entries(COLORS)) {
      expect(cell(variant, "always", "rest"), variant).toEqual(link(color, dimmed(color)));
      expect(cell(variant, "always", "hover"), variant).toEqual(link(color, LINE));
    }
  });

  it("underlines a hover link only on hover", () => {
    for (const [variant, color] of Object.entries(COLORS)) {
      expect(cell(variant, "hover", "rest"), variant).toEqual(link(color, undefined));
      expect(cell(variant, "hover", "hover"), variant).toEqual(link(color, LINE));
    }
  });

  it("never underlines a none link and fades it to 80% on hover", () => {
    for (const [variant, color] of Object.entries(COLORS)) {
      expect(cell(variant, "none", "rest"), variant).toEqual(link(color, undefined));
      expect(cell(variant, "none", "hover"), variant).toEqual({ ...link(color, undefined), opacity: 0.8 });
    }
  });

  it("rings a focused link with the 2px ring and keeps its resting underline", () => {
    for (const [variant, color] of Object.entries(COLORS)) {
      expect(cell(variant, "always", "focus"), variant).toEqual({
        ...link(color, dimmed(color)),
        shadows: [FOCUS_RING],
      });
      expect(cell(variant, "none", "focus"), variant).toEqual({
        ...link(color, undefined),
        shadows: [FOCUS_RING],
      });
    }
  });

  it("drops the cursor, the transition and the line fragments", () => {
    const rows = coverage.filter((row) => row.component === "Link");
    const outcomes = (className: string) =>
      new Set(
        rows.filter((row) => row.className === className).map((row) => `${row.property}: ${row.outcome}`)
      );
    expect(outcomes("cursor-pointer")).toEqual(new Set(["cursor: dropped"]));
    expect(outcomes("transition-[opacity,text-decoration-color]")).toEqual(
      new Set([
        "transition-property: dropped",
        "transition-timing-function: dropped",
        "transition-duration: dropped",
      ])
    );
    expect(outcomes("box-decoration-clone")).toEqual(
      new Set(["box-decoration-break: dropped", "-webkit-box-decoration-break: dropped"])
    );
  });

  it("binds the light arm of the resting underline color and records the dark arm it leaves out", () => {
    const dimmedRows = coverage.filter(
      (row) => row.component === "Link" && row.property === "text-decoration-color" && row.outcome === "bound"
    );
    const tints = new Set(
      ["foreground", "primary", "brand", "muted-foreground", "error"].map((role) => `${role}/35`)
    );
    expect(new Set(dimmedRows.map((row) => /Fuse tokens \/ (\S+),/.exec(row.detail)?.[1]))).toEqual(tints);
    for (const row of dimmedRows) {
      expect(row.detail, row.detail).toContain(
        "The dark arm color-mix(in oklab,currentcolor 65%,transparent) is not drawn"
      );
    }
  });
});
