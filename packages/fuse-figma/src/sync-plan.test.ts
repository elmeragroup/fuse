import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { CollectionId, ModeId, VariableId } from "./file-variables.ts";
import type { FileCollection, FileMode, FileValue, FileVariables, ModeChange } from "./file-variables.ts";
import { changeBatch, planSync } from "./sync-plan.ts";
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
        codeSyntax: { WEB: "var(--red)" },
        values: new Map(modes.map((mode) => [mode.id, red])),
      },
      {
        id: VariableId("VariableID:1:11"),
        name: "danger",
        type: "COLOR",
        scopes: [],
        codeSyntax: {},
        values: new Map(modes.map((mode) => [mode.id, alias])),
      },
    ],
  };
}

/** The plan's changes and the batch that applies them. */
function plan(file: FileVariables, desired: VariableSet = variableSet()) {
  const result = planSync(desired, file);
  if (Result.isFailure(result)) {
    throw new Error(`expected a plan, got ${result.failure._tag}`);
  }
  return { changes: result.success.changes, batch: changeBatch(result.success) };
}

/** A one-collection set whose single variable has a number in each of `modes`. */
function themesSet(modes: readonly string[]): VariableSet {
  const result = makeVariableSet([
    {
      name: "Themes",
      modes,
      variables: [
        {
          name: "radius",
          type: "FLOAT",
          scopes: [],
          webSyntax: undefined,
          values: new Map(modes.map((mode) => [mode, { _tag: "Float", value: 4 }])),
        },
      ],
    },
  ]);
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

function themesFile(modes: readonly string[]): FileVariables {
  return {
    collections: [
      {
        id: CollectionId("VariableCollectionId:1:1"),
        name: "Themes",
        modes: modes.map((name, index) => ({ id: ModeId(`1:${index}`), name })),
        variables: [],
      },
    ],
  };
}

/**
 * Apply mode changes the way the Figma REST API documents them, one after the other, and
 * return the mode names after each. Figma refuses a collection over 40 modes or without one.
 */
function replayModes(start: readonly FileMode[], changes: readonly ModeChange[]): string[][] {
  const modes = new Map(start.map((mode) => [String(mode.id), mode.name]));
  return changes.map((change) => {
    if (change._tag === "DeleteMode") modes.delete(change.id);
    else modes.set(change.id, change.name);
    return [...modes.values()];
  });
}

const range = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

describe("planSync", () => {
  it("creates a collection, names its initial mode and aliases through temporary ids", () => {
    const { batch, changes } = plan({ collections: [] });

    expect(batch.collections).toEqual([
      { id: "tmp_collection_0", name: "Palette", initialModeId: "tmp_mode_0_0" },
    ]);
    expect(batch.modes).toEqual([
      { _tag: "NameInitialMode", collectionId: "tmp_collection_0", id: "tmp_mode_0_0", name: "Light" },
      { _tag: "CreateMode", collectionId: "tmp_collection_0", id: "tmp_mode_0_1", name: "Dark" },
    ]);
    expect(batch.variables.map((change) => change._tag)).toEqual(["CreateVariable", "CreateVariable"]);
    expect(batch.values).toContainEqual({
      variableId: "tmp_variable_0_1",
      modeId: "tmp_mode_0_1",
      value: { _tag: "Alias", id: "tmp_variable_0_0" },
    });
    expect(batch.values).toHaveLength(4);
    expect(changes.slice(0, 3)).toMatchObject([
      { _tag: "CreateCollection", collection: "Palette" },
      { _tag: "CreateMode", collection: "Palette", mode: "Light" },
      { _tag: "CreateMode", collection: "Palette", mode: "Dark" },
    ]);
  });

  it("changes nothing when the file already matches", () => {
    expect(plan({ collections: [syncedPalette()] }).changes).toEqual([]);
  });

  it("ignores float round-trip noise but writes a real color change against the existing ids", () => {
    const noisy: FileValue = { _tag: "Color", color: { r: 0.99995, g: 0.00005, b: 0, a: 1 } };
    expect(plan({ collections: [syncedPalette([LIGHT, DARK], noisy)] }).changes).toEqual([]);

    const changed: FileValue = { _tag: "Color", color: { r: 0.9, g: 0, b: 0, a: 1 } };
    const { batch, changes } = plan({ collections: [syncedPalette([LIGHT, DARK], changed)] });
    expect(changes).toMatchObject([
      { _tag: "SetValue", collection: "Palette", variable: "red", mode: "Light" },
      { _tag: "SetValue", collection: "Palette", variable: "red", mode: "Dark" },
    ]);
    expect(batch.values).toEqual([
      { variableId: "VariableID:1:10", modeId: "1:0", value: { _tag: "Color", color: RED } },
      { variableId: "VariableID:1:10", modeId: "1:1", value: { _tag: "Color", color: RED } },
    ]);
  });

  it("deletes a stale mode and creates the missing one instead of renaming it", () => {
    const sepia: FileMode = { id: ModeId("1:2"), name: "Sepia" };
    const { batch, changes } = plan({ collections: [syncedPalette([LIGHT, sepia])] });

    expect(batch.modes).toEqual([
      { _tag: "DeleteMode", collectionId: "VariableCollectionId:1:1", id: "1:2" },
      { _tag: "CreateMode", collectionId: "VariableCollectionId:1:1", id: "tmp_mode_0_1", name: "Dark" },
    ]);
    expect(changes).toMatchObject([
      { _tag: "DeleteMode", collection: "Palette", mode: "Sepia" },
      { _tag: "CreateMode", collection: "Palette", mode: "Dark" },
      { _tag: "SetValue", collection: "Palette", variable: "red", mode: "Dark" },
      { _tag: "SetValue", collection: "Palette", variable: "danger", mode: "Dark" },
    ]);
    // The new mode gets every value, and Sepia's values go with it.
    expect(batch.values).toEqual([
      { variableId: "VariableID:1:10", modeId: "tmp_mode_0_1", value: { _tag: "Color", color: RED } },
      {
        variableId: "VariableID:1:11",
        modeId: "tmp_mode_0_1",
        value: { _tag: "Alias", id: "VariableID:1:10" },
      },
    ]);
  });

  it("keeps one stale mode until the first new mode exists when no mode survives", () => {
    const sepia: FileMode = { id: ModeId("1:2"), name: "Sepia" };
    const mono: FileMode = { id: ModeId("1:3"), name: "Mono" };
    expect(plan({ collections: [syncedPalette([sepia, mono])] }).batch.modes).toEqual([
      { _tag: "DeleteMode", collectionId: "VariableCollectionId:1:1", id: "1:2" },
      { _tag: "CreateMode", collectionId: "VariableCollectionId:1:1", id: "tmp_mode_0_0", name: "Light" },
      { _tag: "DeleteMode", collectionId: "VariableCollectionId:1:1", id: "1:3" },
      { _tag: "CreateMode", collectionId: "VariableCollectionId:1:1", id: "tmp_mode_0_1", name: "Dark" },
    ]);
  });

  it.each([
    {
      case: "one stale mode swapped at the 40-mode cap",
      file: [...range(39, "kept"), "old"],
      set: [...range(39, "kept"), "new"],
    },
    { case: "40 stale modes replaced by 40 new ones", file: range(40, "old"), set: range(40, "new") },
    { case: "one stale mode replaced by 40 new ones", file: ["Mode 1"], set: range(40, "new") },
    { case: "40 stale modes replaced by one new one", file: range(40, "old"), set: ["Value"] },
  ])("stays within 1 to 40 modes while Figma applies $case", ({ file, set }) => {
    const current = themesFile(file);
    const start = current.collections[0]?.modes ?? [];
    const steps = replayModes(start, plan(current, themesSet(set)).batch.modes);

    for (const modes of steps) {
      expect(modes.length).toBeGreaterThanOrEqual(1);
      expect(modes.length).toBeLessThanOrEqual(40);
    }
    expect(new Set(steps.at(-1))).toEqual(new Set(set));
  });

  it("owns only the web syntax it sets and sends the other platforms back unchanged", () => {
    const file = syncedPalette();
    const [red, danger] = file.variables;
    if (red === undefined || danger === undefined) throw new Error("fixture has two variables");
    const edited = {
      ...file,
      variables: [
        { ...red, codeSyntax: { WEB: "var(--old-red)", ANDROID: "R.color.red", iOS: "Color.red" } },
        { ...danger, scopes: ["ALL_SCOPES"], codeSyntax: { WEB: "var(--designer-note)" } },
      ],
    };

    const { batch } = plan({ collections: [edited] });
    expect(batch.variables).toEqual([
      {
        _tag: "UpdateVariable",
        id: "VariableID:1:10",
        metadata: {
          scopes: ["ALL_SCOPES"],
          codeSyntax: { WEB: "var(--red)", ANDROID: "R.color.red", iOS: "Color.red" },
        },
      },
      { _tag: "UpdateVariable", id: "VariableID:1:11", metadata: { scopes: [], codeSyntax: undefined } },
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
