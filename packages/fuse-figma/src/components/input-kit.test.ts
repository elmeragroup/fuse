/**
 * Unit under test: the Input component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `inputClass` in `input-class.ts`,
 * `fieldBox` in `field-box.ts`, `fieldCornerClass` in `corner-radius.ts`, `control-size-md.ts`,
 * `state-face.ts`, the focus ring in `styles/utils.ts` and Tailwind's `shadow-xs`, and from the
 * browser's rendering of `<input>` in `research/input-textarea.md`: the box is 384px wide, the
 * preview width, at both densities and draws its value on one line from the start of its content
 * box, centered down it. The placeholder paints `muted-foreground` through `::placeholder`, and a
 * typed value inherits the page's `foreground`, or the `error` an invalid Field root sets through
 * `data-invalid:text-error` (`field-variants.ts`).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { fieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import {
  builtKit,
  density,
  ERROR_RING,
  FILL,
  fixed,
  FOCUS_RING,
  HUG,
  literal,
  paint,
  SHADOW_XS,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { splitClasses } from "./cascade";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec, TextLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function input(content: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `input/content=${content},state=${state}`);
}

function textOf(box: ComponentRootSpec): TextLayerSpec | undefined {
  const [first] = box.children;
  return first?.kind === "text" ? first : undefined;
}

const STATES = ["rest", "focus", "disabled", "readonly", "invalid"];

describe("the Input component set", () => {
  it("holds placeholder and value in five states, with columns by state and one Text property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "input");
    expect(set?.axes).toEqual([
      { name: "content", values: ["placeholder", "value"] },
      { name: "state", values: STATES },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(10);
    expect([set?.textProperties, set?.swapProperties]).toEqual([
      [{ name: "Text", defaultValue: "name@example.com" }],
      [],
    ]);
  });

  it("draws a 384px card field box with the field corner, its text filling the padded row on one line", () => {
    expect(input("placeholder", "rest")).toEqual({
      name: "input",
      direction: "HORIZONTAL",
      sizing: { horizontal: fixed(literal(384)), vertical: fixed(density("control-h-md")) },
      limits: UNLIMITED,
      clips: true,
      paddingTop: literal(0),
      paddingRight: density("control-px-md"),
      paddingBottom: literal(0),
      paddingLeft: density("control-px-md"),
      itemSpacing: literal(0),
      primaryAlign: "MIN",
      counterAlign: "CENTER",
      cornerRadius: token("radius-field-box"),
      fill: paint("card"),
      stroke: { color: paint("input"), weight: literal(1) },
      shadows: [SHADOW_XS],
      opacity: 1,
      children: [
        {
          kind: "text",
          key: "text",
          name: "text",
          characters: "name@example.com",
          textProperty: "Text",
          fontFamily: token("font-sans"),
          fontStyle: "Regular",
          fontSize: density("control-text"),
          lineHeight: density("control-leading"),
          color: paint("muted-foreground"),
          underline: undefined,
          sizing: { horizontal: FILL, vertical: HUG },
          align: { horizontal: "LEFT", vertical: "TOP" },
          truncation: { maxLines: 1 },
        },
      ],
    });
  });

  // `input-kit.ts` hand-writes the `color: var(--error)` an invalid Field root passes down, so a
  // change to the Field recipe's invalid text class must fail here before the kit draws a stale color.
  it("inherits the text color of the class an invalid Field root carries", () => {
    expect(splitClasses(fieldVariants().root())).toContain("data-invalid:text-error");
  });

  it("paints the placeholder muted-foreground, a value foreground, and an invalid value error", () => {
    const colors = (content: string) => STATES.map((state) => textOf(input(content, state))?.color);
    expect(colors("placeholder")).toEqual(STATES.map(() => paint("muted-foreground")));
    expect(colors("value")).toEqual([
      paint("foreground"),
      paint("foreground"),
      paint("foreground"),
      paint("foreground"),
      paint("error"),
    ]);
  });

  it("rings focus, strokes and rings invalid with error, and keeps the input border otherwise", () => {
    for (const content of ["placeholder", "value"]) {
      const focus = input(content, "focus");
      expect([focus.stroke?.color, focus.shadows]).toEqual([paint("input"), [FOCUS_RING, SHADOW_XS]]);
      const invalid = input(content, "invalid");
      expect([invalid.stroke?.color, invalid.shadows]).toEqual([paint("error"), [ERROR_RING, SHADOW_XS]]);
    }
  });

  it("dims disabled to 50% on the input/50 fill, and fills read-only with muted", () => {
    for (const content of ["placeholder", "value"]) {
      const disabled = input(content, "disabled");
      expect([disabled.opacity, disabled.fill]).toEqual([0.5, paint("input/50")]);
      const readonly = input(content, "readonly");
      expect([readonly.opacity, readonly.fill]).toEqual([1, paint("muted")]);
    }
  });

  it("drops the file button, the touch floor, aria-disabled and the shell's custom properties, each with its reason", () => {
    const reasons = (match: (className: string) => boolean) =>
      new Set(
        coverage
          .filter((row) => row.component === "Input" && match(row.className))
          .map((row) => `${row.outcome}: ${row.detail}`)
      );
    expect(reasons((className) => className.startsWith("file:"))).toEqual(
      new Set(["dropped: the button of a file input, which the kit does not draw"])
    );
    expect(reasons((className) => className.startsWith("entry-floor:"))).toEqual(
      new Set(["dropped: no cell of the matrix shows `entry-floor`"])
    );
    expect(reasons((className) => className.startsWith("aria-disabled:"))).toEqual(
      new Set(["dropped: no cell of the matrix shows `aria-disabled`"])
    );
    expect(
      reasons((className) =>
        ["[--shell-inner:", "[--shell-corner:", "[--inner-corner:"].some((prefix) =>
          className.startsWith(prefix)
        )
      )
    ).toEqual(
      new Set([
        "dropped: a custom property passes its value down, and the box holds no part or icon to take it",
      ])
    );
  });
});
