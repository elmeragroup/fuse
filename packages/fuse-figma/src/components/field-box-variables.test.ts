/**
 * Unit under test: the code syntax `fuseVariableSet` gives `radius-field-box` and `input/50`, as
 * `buildComponentSet` binds it. Oracle: Tailwind's compile of the field box's corner classes in
 * `corner-radius.ts` and of the `bg-input/50` fill in `field-box.ts`, read on the `chip` fixture.
 * No kit set renders a field box yet, so no kit test reaches these classes.
 */
import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { paint, token } from "../../test/built-kit";
import { buildFixture, chip } from "../../test/fixture-sets";
import { fuseVariableSet } from "../fuse-variable-set";
import { makeVariableIndex } from "./css-values";
import type { VariableIndex } from "./css-values";

/**
 * `fieldCornerClass` in `corner-radius.ts`: the box declares its corner as `--field-corner` and
 * rounds with it.
 */
const FIELD_CORNER =
  "rounded-(--field-corner) [--field-corner:clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px))]";

/** Every synced variable that carries code syntax, which a compiled value can bind. */
function syncedVariables(): VariableIndex {
  const set = fuseVariableSet();
  if (Result.isFailure(set)) {
    throw new Error(`the Fuse variable set does not build: ${String(set.failure)}`);
  }
  return makeVariableIndex(
    set.success.collections.flatMap((collection) =>
      collection.variables.flatMap((variable) =>
        variable.webSyntax === undefined
          ? []
          : [{ ref: { collection: collection.name, name: variable.name }, webSyntax: variable.webSyntax }]
      )
    )
  );
}

describe("the field box's corner and disabled fill", () => {
  it("bind the field box corner and the input/50 tint the sync writes", async () => {
    const { variant, coverage } = await buildFixture(chip(`${FIELD_CORNER} bg-input/50`), {
      variables: syncedVariables(),
    });
    expect(variant?.root.cornerRadius).toEqual(token("radius-field-box"));
    expect(variant?.root.fill).toEqual(paint("input/50"));
    expect(coverage.filter((row) => row.outcome !== "bound")).toEqual([]);
  });
});
