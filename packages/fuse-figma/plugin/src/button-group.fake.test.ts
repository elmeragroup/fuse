/**
 * The Button group set's members on the in-memory file in `fake-figma.ts`, the whole kit applied to
 * it. Unit under test: the plugin's instance overrides (`instance-overrides.ts`, `box.ts`) through
 * `reconcileKit`. Oracle: the docs demos as the kit draws them. A horizontal group's first member
 * keeps `radius-md` on its left corners, its last on its right, the inner corners are 0 and each
 * member after the first leaves its left side bare of the outline width; a vertical group does the
 * same down its top and bottom. A real file's instance took each corner and side on its own, kept the
 * others following the main, and listed only the fields it wrote (probes CR1 to CR3, CR7), so the
 * next Plan, which reads them equal, lists nothing.
 */
import { describe, expect, it } from "vitest";

import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** A layer's value on each of `fields`, as its variable's name where it binds one. */
async function shown(
  file: FakeFigma,
  node: InstanceNode,
  fields: readonly (
    | "topLeftRadius"
    | "topRightRadius"
    | "bottomRightRadius"
    | "bottomLeftRadius"
    | "strokeTopWeight"
    | "strokeRightWeight"
    | "strokeBottomWeight"
    | "strokeLeftWeight"
  )[]
): Promise<readonly (string | number)[]> {
  return Promise.all(
    fields.map(async (field) => {
      const id = node.boundVariables?.[field]?.id;
      return id === undefined
        ? node[field]
        : ((await file.figma.variables.getVariableByIdAsync(id))?.name ?? id);
    })
  );
}

const CORNERS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

const SIDES = ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"] as const;

const MD = "radius-md";

const OUTLINE = "button-outline-width";

describe("the Button group set on an applied file", () => {
  // The first member in each orientation takes no `strokeSides` override and keeps all four sides.
  it.each([
    [
      "horizontal",
      {
        archive: [
          [MD, 0, 0, MD],
          [OUTLINE, OUTLINE, OUTLINE, OUTLINE],
        ],
        snooze: [
          [0, 0, 0, 0],
          [OUTLINE, OUTLINE, OUTLINE, 0],
        ],
        report: [
          [0, MD, MD, 0],
          [OUTLINE, OUTLINE, OUTLINE, 0],
        ],
      },
    ],
    [
      "vertical",
      {
        increase: [
          [MD, MD, 0, 0],
          [OUTLINE, OUTLINE, OUTLINE, OUTLINE],
        ],
        decrease: [
          [0, 0, MD, MD],
          [0, OUTLINE, OUTLINE, OUTLINE],
        ],
      },
    ],
  ] as const)(
    "gives each %s member its corners and sides, and the next Plan lists nothing",
    async (orientation, members) => {
      const file = await appliedFile();
      const set = setOn(await kitPage(file), "Button group");
      const variant = childNamed(set, "COMPONENT", `orientation=${orientation}`);
      const drawn = Object.fromEntries(
        await Promise.all(
          Object.keys(members).map(async (key) => {
            const member = variant.children.find(
              (child): child is InstanceNode => child.type === "INSTANCE" && keyOf(child) === key
            );
            if (member === undefined) {
              throw new Error(`orientation=${orientation} holds no member ${key}`);
            }
            return [key, [await shown(file, member, CORNERS), await shown(file, member, SIDES)]] as const;
          })
        )
      );
      const { kit } = await kitFixture();
      const plan = await reconcileKit(file.figma, kit, false);
      expect([drawn, plan.changes]).toEqual([members, []]);
    }
  );
});
