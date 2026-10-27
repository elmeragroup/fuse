/**
 * Unit under test: the `File upload dropzone` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `file-upload-variants.ts`,
 * `file-upload-dropzone.tsx` and the docs Compact demo, and Chromium's layout of the demo with
 * preflight and Fuse's built CSS on 2026-10-27:
 *
 * - The zone is 512px wide, the demo's `max-w-lg`, and hugs its height: 58px dense and 70px
 *   comfortable, a 1px border, `surface-pad-md` padding (12px and 16px) and the 32px or 36px small
 *   Button. Its 8px or 12px gap, `surface-gap-sm`, sets the trigger and the description apart, centred
 *   across, and its corners are `radius-md`, 8px.
 * - The description hugs its one line, 261.7×20 dense and 299×24 comfortable.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, fixed, HUG, literal, paint, token, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

const zone = (state: string) => variantRoot(spec, `file-upload-dropzone/state=${state}`);

describe("the File upload dropzone component set", () => {
  it("sits on its own page at rest, hovered, focused, as a drop target and disabled", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "file-upload-dropzone");
    expect([set?.name, set?.page, set?.axes, set?.textProperties.map((property) => property.name)]).toEqual([
      "File upload dropzone",
      "page/file-upload",
      [{ name: "state", values: ["rest", "hover", "focus", "drop-target", "disabled"] }],
      ["Description"],
    ]);
  });

  it("lays the small Add files trigger and the hugging description in a padded 512px row", () => {
    const root = zone("rest");
    expect(root).toMatchObject({
      direction: "HORIZONTAL",
      sizing: { horizontal: fixed(literal(512)), vertical: HUG },
      paddingTop: density("surface-pad-md"),
      paddingLeft: density("surface-pad-md"),
      itemSpacing: density("surface-gap-sm"),
      counterAlign: "CENTER",
      cornerRadius: token("radius-md"),
    });
    expect(root.children).toMatchObject([
      {
        kind: "instance",
        variant: "button/variant=default,size=sm,state=rest,icon=start",
        properties: { text: { Label: "Add files" } },
        exposed: true,
      },
      {
        kind: "frame",
        sizing: { horizontal: HUG, vertical: HUG },
        children: [
          {
            kind: "text",
            characters: "Drop files here or click to browse (max 3 files)",
            fontSize: density("label-text"),
            lineHeight: density("label-leading"),
            color: paint("muted-foreground"),
          },
        ],
      },
    ]);
  });

  it("draws a dashed border stroke at rest and strengthens it to muted-foreground/50 on hover and focus", () => {
    expect([zone("rest").stroke, zone("hover").stroke?.color, zone("focus").stroke?.color]).toEqual([
      { color: paint("border"), weight: literal(1), dashPattern: [3, 2] },
      paint("muted-foreground/50"),
      paint("muted-foreground/50"),
    ]);
  });

  it("turns a drop target's border solid primary on a primary-soft fill", () => {
    expect([zone("drop-target").stroke, zone("drop-target").fill]).toEqual([
      { color: paint("primary"), weight: literal(1) },
      paint("primary-soft"),
    ]);
  });

  it("rings a focused zone's trigger, and dims a disabled zone to 50% with its trigger disabled", () => {
    const trigger = (state: string) => {
      const [first] = zone(state).children;
      return first?.kind === "instance" ? first.variant : undefined;
    };
    expect([trigger("hover"), trigger("focus"), trigger("drop-target"), trigger("disabled")]).toEqual([
      "button/variant=default,size=sm,state=rest,icon=start",
      "button/variant=default,size=sm,state=focus,icon=start",
      "button/variant=default,size=sm,state=rest,icon=start",
      "button/variant=default,size=sm,state=disabled,icon=start",
    ]);
    expect([zone("rest").opacity, zone("disabled").opacity]).toEqual([1, 0.5]);
  });
});
