import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { CollectionId, ModeId, VariableId } from "./file-variables.ts";
import type { FileCollection, FileMode, FileValue, FileVariables } from "./file-variables.ts";
import { isInSync, planSync } from "./sync-plan.ts";
import type { SyncPlan } from "./sync-plan.ts";
import { makeVariableSet } from "./variable-set.ts";
import type { VariableSet } from "./variable-set.ts";

const RED = { r: 1, g: 0, b: 0, a: 1 };

function variableSet(): VariableSet {
  const result = makeVariableSet([
    {
      name: "Palette",
      modes: ["Light", "Dark"],
      variables: [
        {
          name: "red",
          type: "COLOR",
          scopes: ["ALL_SCOPES"],
          webSyntax: "var(--red)",
          values: new Map([
            ["Light", { _tag: "Color", color: RED }],
            ["Dark", { _tag: "Color", color: RED }],
          ]),
        },
        {
          name: "danger",
          type: "COLOR",
          scopes: [],
          webSyntax: undefined,
          values: new Map([
            ["Light", { _tag: "Alias", target: { collection: "Palette", variable: "red" } }],
            ["Dark", { _tag: "Alias", target: { collection: "Palette", variable: "red" } }],
          ]),
        },
      ],
    },
  ]);
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

const LIGHT: FileMode = { id: ModeId("1:0"), name: "Light" };
const DARK: FileMode = { id: ModeId("1:1"), name: "Dark" };

/** The file state the palette produces, with real ids, over the given modes. */
function syncedPalette(
  modes: readonly FileMode[] = [LIGHT, DARK],
  red: FileValue = { _tag: "Color", color: RED }
): FileCollection {
  const alias: FileValue = { _tag: "Alias", id: VariableId("VariableID:1:10") };
  return {
    id: CollectionId("VariableCollectionId:1:1"),
    name: "Palette",
    modes,
    variables: [
      {
        id: VariableId("VariableID:1:10"),
        name: "red",
        type: "COLOR",
        scopes: ["ALL_SCOPES"],
        webSyntax: "var(--red)",
        values: new Map(modes.map((mode) => [mode.id, red])),
      },
      {
        id: VariableId("VariableID:1:11"),
        name: "danger",
        type: "COLOR",
        scopes: [],
        webSyntax: undefined,
        values: new Map(modes.map((mode) => [mode.id, alias])),
      },
    ],
  };
}

function plan(file: FileVariables): SyncPlan {
  const result = planSync(variableSet(), file);
  if (Result.isFailure(result)) {
    throw new Error(`expected a plan, got ${result.failure._tag}`);
  }
  return result.success;
}

describe("planSync", () => {
  it("creates a collection, names its initial mode and aliases through temporary ids", () => {
    const { batch, changes } = plan({ collections: [] });

    expect(batch.collections).toEqual([
      { id: "tmp_collection_0", name: "Palette", initialModeId: "tmp_mode_0_0" },
    ]);
    expect(batch.modes).toEqual([
      { _tag: "RenameMode", collectionId: "tmp_collection_0", id: "tmp_mode_0_0", name: "Light" },
      { _tag: "CreateMode", collectionId: "tmp_collection_0", id: "tmp_mode_0_1", name: "Dark" },
    ]);
    expect(batch.variables.map((change) => change._tag)).toEqual(["CreateVariable", "CreateVariable"]);
    expect(batch.values).toContainEqual({
      variableId: "tmp_variable_0_1",
      modeId: "tmp_mode_0_1",
      value: { _tag: "Alias", id: "tmp_variable_0_0" },
    });
    expect(batch.values).toHaveLength(4);
    expect(changes.slice(0, 3)).toEqual([
      { _tag: "CreateCollection", collection: "Palette" },
      { _tag: "CreateMode", collection: "Palette", mode: "Light" },
      { _tag: "CreateMode", collection: "Palette", mode: "Dark" },
    ]);
  });

  it("changes nothing when the file already matches", () => {
    expect(isInSync(plan({ collections: [syncedPalette()] }))).toBe(true);
  });

  it("ignores float round-trip noise but writes a real color change against the existing ids", () => {
    const noisy: FileValue = { _tag: "Color", color: { r: 0.99995, g: 0.00005, b: 0, a: 1 } };
    expect(isInSync(plan({ collections: [syncedPalette([LIGHT, DARK], noisy)] }))).toBe(true);

    const changed: FileValue = { _tag: "Color", color: { r: 0.9, g: 0, b: 0, a: 1 } };
    const { batch, changes } = plan({ collections: [syncedPalette([LIGHT, DARK], changed)] });
    expect(changes).toEqual([
      { _tag: "SetValue", collection: "Palette", variable: "red", mode: "Light" },
      { _tag: "SetValue", collection: "Palette", variable: "red", mode: "Dark" },
    ]);
    expect(batch.values).toEqual([
      { variableId: "VariableID:1:10", modeId: "1:0", value: { _tag: "Color", color: RED } },
      { variableId: "VariableID:1:10", modeId: "1:1", value: { _tag: "Color", color: RED } },
    ]);
  });

  it("renames a stale mode to a missing name, keeping its id and the values it already holds", () => {
    const sepia: FileMode = { id: ModeId("1:2"), name: "Sepia" };
    const { batch, changes } = plan({ collections: [syncedPalette([LIGHT, sepia])] });

    expect(batch.modes).toEqual([
      { _tag: "RenameMode", collectionId: "VariableCollectionId:1:1", id: "1:2", name: "Dark" },
    ]);
    expect(changes).toEqual([{ _tag: "RenameMode", collection: "Palette", from: "Sepia", mode: "Dark" }]);
    expect(batch.values).toEqual([]);
  });

  it("deletes a mode only when no missing name is left to rename it to", () => {
    const sepia: FileMode = { id: ModeId("1:2"), name: "Sepia" };
    const mono: FileMode = { id: ModeId("1:3"), name: "Mono" };
    expect(plan({ collections: [syncedPalette([LIGHT, sepia, mono])] }).batch.modes).toEqual([
      { _tag: "RenameMode", collectionId: "VariableCollectionId:1:1", id: "1:2", name: "Dark" },
      { _tag: "DeleteMode", collectionId: "VariableCollectionId:1:1", id: "1:3" },
    ]);

    expect(plan({ collections: [syncedPalette([LIGHT])] }).batch.modes).toEqual([
      { _tag: "CreateMode", collectionId: "VariableCollectionId:1:1", id: "tmp_mode_0_1", name: "Dark" },
    ]);
  });

  it("owns only the web syntax it sets", () => {
    const file = syncedPalette();
    const [red, danger] = file.variables;
    if (red === undefined || danger === undefined) throw new Error("fixture has two variables");
    const edited = {
      ...file,
      variables: [
        { ...red, webSyntax: "var(--old-red)" },
        { ...danger, scopes: ["ALL_SCOPES"], webSyntax: "var(--designer-note)" },
      ],
    };

    const { batch } = plan({ collections: [edited] });
    expect(batch.variables).toEqual([
      {
        _tag: "UpdateVariable",
        id: "VariableID:1:10",
        metadata: { scopes: ["ALL_SCOPES"], webSyntax: "var(--red)" },
      },
      { _tag: "UpdateVariable", id: "VariableID:1:11", metadata: { scopes: [], webSyntax: undefined } },
    ]);
  });

  it("refuses to plan when a collection name is ambiguous or a type would change", () => {
    const duplicate = planSync(variableSet(), { collections: [syncedPalette(), syncedPalette()] });
    expect(Result.isFailure(duplicate) && duplicate.failure._tag).toBe("DuplicateCollection");

    const file = syncedPalette();
    const [red, danger] = file.variables;
    if (red === undefined || danger === undefined) throw new Error("fixture has two variables");
    const retyped = planSync(variableSet(), {
      collections: [{ ...file, variables: [{ ...red, type: "FLOAT" }, danger] }],
    });
    expect(Result.isFailure(retyped) && retyped.failure._tag).toBe("VariableTypeConflict");
  });
});
