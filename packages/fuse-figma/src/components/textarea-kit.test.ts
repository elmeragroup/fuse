/**
 * Unit under test: the Textarea component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `textareaClass` in
 * `textarea-class.ts` (`fieldBox({ box: "content" })` with `flex field-sizing-content`), `fieldBox` in
 * `field-box.ts`, `fieldCornerClass` in `corner-radius.ts`, `control-size-md.ts`, `state-face.ts`, the
 * focus ring in `styles/utils.ts` and Tailwind's `shadow-xs` and `min-h-16`, and from the browser's
 * rendering of `<textarea>` in `research/input-textarea.md`: the box is 384px wide, the preview
 * width, at both densities. `field-sizing: content` makes its height follow its text, and
 * `min-h-16` keeps it at least 64px tall. It wraps its value in its content box from the top left,
 * between the 8px block paddings. The placeholder paints `muted-foreground` through `::placeholder`,
 * and a typed value inherits the page's `foreground`, or the `error` an invalid Field root sets
 * through `data-invalid:text-error` (`field-variants.ts`).
 */
import { beforeAll, describe, expect, it } from "vitest";

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
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec, TextLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function textarea(content: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `textarea/content=${content},state=${state}`);
}

function textOf(box: ComponentRootSpec): TextLayerSpec | undefined {
  const [first] = box.children;
  return first?.kind === "text" ? first : undefined;
}

const STATES = ["rest", "focus", "disabled", "readonly", "invalid"];

describe("the Textarea component set", () => {
  it("holds placeholder and value in five states, with columns by state and one Text property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "textarea");
    expect(set?.axes).toEqual([
      { name: "content", values: ["placeholder", "value"] },
      { name: "state", values: STATES },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(10);
    expect([set?.textProperties, set?.swapProperties]).toEqual([
      [{ name: "Text", defaultValue: "Tell us more…" }],
      [],
    ]);
  });

  it("draws a 384px card field box at least 64px tall that hugs its text, which fills the row and wraps from the top left", () => {
    expect(textarea("placeholder", "rest")).toEqual({
      name: "textarea",
      direction: "HORIZONTAL",
      sizing: { horizontal: fixed(literal(384)), vertical: HUG },
      limits: { ...UNLIMITED, minHeight: literal(64) },
      clips: true,
      paddingTop: literal(8),
      paddingRight: density("control-px-md"),
      paddingBottom: literal(8),
      paddingLeft: density("control-px-md"),
      itemSpacing: literal(0),
      primaryAlign: "MIN",
      counterAlign: "MIN",
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
          characters: "Tell us more…",
          textProperty: "Text",
          fontFamily: token("font-sans"),
          fontStyle: "Regular",
          fontSize: density("control-text"),
          lineHeight: density("control-leading"),
          color: paint("muted-foreground"),
          underline: undefined,
          sizing: { horizontal: FILL, vertical: HUG },
          align: { horizontal: "LEFT", vertical: "TOP" },
          truncation: undefined,
        },
      ],
    });
    // `toEqual` skips a field it expects undefined, so the absent truncation is checked on its own.
    expect(textOf(textarea("placeholder", "rest"))?.truncation).toBeUndefined();
  });

  it("paints the placeholder muted-foreground, a value foreground, and an invalid value error", () => {
    const colors = (content: string) => STATES.map((state) => textOf(textarea(content, state))?.color);
    expect(colors("placeholder")).toEqual(STATES.map(() => paint("muted-foreground")));
    expect(colors("value")).toEqual([
      paint("foreground"),
      paint("foreground"),
      paint("foreground"),
      paint("foreground"),
      paint("error"),
    ]);
  });

  it.each([
    ["rest", paint("input"), [SHADOW_XS], paint("card"), 1],
    ["focus", paint("input"), [FOCUS_RING, SHADOW_XS], paint("card"), 1],
    ["disabled", paint("input"), [SHADOW_XS], paint("input/50"), 0.5],
    ["readonly", paint("input"), [SHADOW_XS], paint("muted"), 1],
    ["invalid", paint("error"), [ERROR_RING, SHADOW_XS], paint("card"), 1],
  ] as const)("draws the %s face in both contents", (state, stroke, shadows, fill, opacity) => {
    for (const content of ["placeholder", "value"]) {
      const box = textarea(content, state);
      expect([box.stroke?.color, box.shadows, box.fill, box.opacity]).toEqual([
        stroke,
        shadows,
        fill,
        opacity,
      ]);
    }
  });

  it("drops the touch floor, aria-disabled and the shell's custom properties, each with its reason", () => {
    const reasons = (match: (className: string) => boolean) =>
      new Set(
        coverage
          .filter((row) => row.component === "Textarea" && match(row.className))
          .map((row) => `${row.outcome}: ${row.detail}`)
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
