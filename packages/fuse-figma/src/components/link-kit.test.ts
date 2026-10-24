/**
 * Unit under test: the Link component set as the build produces them. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `styles/link.ts`, from what
 * `react-aria/link/link.tsx` adds to the recipe from React Aria's render props (the state focus
 * ring in `styles/utils.ts` and the rac-target disabled face in `styles/state-face.ts`), from the
 * classes Tailwind compiles them to, and from the docs Router demo, whose first link reads
 * `Invoice 1042`. Link sets no type size, so its text takes the host page's: the browser's 16px
 * `medium` and preflight's `line-height: 1.5` on `<html>`. The `default` variant's `text-inherit`
 * takes the page's `foreground`. `enabled-hover:opacity-80` fades a hovered link to 80%, the focus
 * ring answers `isFocusVisible` with `ring-2 ring-ring`, and the disabled face answers `isDisabled`
 * with `opacity-50`.
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

/**
 * Each variant the set draws and the color its text takes. The recipe also declares `secondary`,
 * the deprecated alias whose class is `foreground`'s, and `inherit`, whose class is `default`'s.
 */
const COLORS = {
  default: "foreground",
  foreground: "foreground",
  primary: "primary",
  brand: "brand",
  muted: "muted-foreground",
  error: "error",
} as const;

/** Each weight and the font style `font-normal` and `font-medium` give Roboto. */
const STYLES = { normal: "Regular", bold: "Medium" } as const;

const STATES = ["rest", "hover", "focus", "disabled"];

/** A link: its text in the host's 16/24px type, in a box that hugs it with no fill or corner. */
function link(color: string, fontStyle: string) {
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
        characters: "Invoice 1042",
        textProperty: "Label",
        fontFamily: token("font-sans"),
        fontStyle,
        fontSize: literal(16),
        lineHeight: literal(24),
        color: paint(color),
        ...HUGGING_LABEL,
      },
    ],
  };
}

/** Every variant and weight with the color and font style its text takes. */
const LOOKS = Object.entries(COLORS).flatMap(([variant, color]) =>
  Object.entries(STYLES).map(([weight, fontStyle]) => ({ variant, weight, color, fontStyle }))
);

describe("the Link component set", () => {
  it("holds 6 variants × 2 weights × 4 states on the Link page, with columns by state and the demo's text", () => {
    const links = spec.componentSets.find((candidate) => candidate.key === "link");
    expect([links?.name, links?.page]).toEqual(["Link", "page/link"]);
    expect(links?.axes).toEqual([
      { name: "variant", values: Object.keys(COLORS) },
      { name: "weight", values: Object.keys(STYLES) },
      { name: "state", values: STATES },
    ]);
    expect(links?.columnAxis).toBe("state");
    expect(new Set(links?.variants.map((cell) => cell.key)).size).toBe(48);
    expect(links?.textProperties).toEqual([{ name: "Label", defaultValue: "Invoice 1042" }]);
    expect(links?.swapProperties).toEqual([]);
  });

  it("draws each variant's text color at each weight at rest, as a box that hugs its text", () => {
    for (const { variant, weight, color, fontStyle } of LOOKS) {
      expect(variantRoot(spec, `link/variant=${variant},weight=${weight},state=rest`), variant).toEqual(
        link(color, fontStyle)
      );
    }
  });

  it("fades a hovered link to 80%, rings a focused one with the 2px ring and dims a disabled one to 50%", () => {
    for (const { variant, weight, color, fontStyle } of LOOKS) {
      const cell = (state: string) =>
        variantRoot(spec, `link/variant=${variant},weight=${weight},state=${state}`);
      const resting = link(color, fontStyle);
      expect(cell("hover"), variant).toEqual({ ...resting, opacity: 0.8 });
      expect(cell("focus"), variant).toEqual({ ...resting, shadows: [FOCUS_RING] });
      expect(cell("disabled"), variant).toEqual({ ...resting, opacity: 0.5 });
    }
  });

  it("drops the cursor and the transition, and leaves nothing unmapped", () => {
    const rows = coverage.filter((row) => row.component === "Link");
    const outcomes = (className: string) =>
      new Set(
        rows.filter((row) => row.className === className).map((row) => `${row.property}: ${row.outcome}`)
      );
    expect(outcomes("cursor-not-allowed")).toEqual(new Set(["cursor: dropped"]));
    expect(outcomes("transition-opacity")).toEqual(
      new Set([
        "transition-property: dropped",
        "transition-timing-function: dropped",
        "transition-duration: dropped",
      ])
    );
    expect(rows.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });
});
