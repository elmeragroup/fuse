/**
 * Small synced files for the plugin's unit tests, on the in-memory file in `fake-figma.ts`. A
 * test names the few variables its planner binds, and gets a file whose collections hold them
 * in one mode, and the run a planner takes. The suites also share a typed child lookup.
 */

import { Effect } from "effect";

import type { GlyphFontSpec } from "../../src/components/kit-spec.ts";
import type {
  CollectionSpec,
  Rgba,
  VariableReference,
  VariableType,
  VariableValue,
} from "../../src/variable-set.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import type { Run } from "./fields.ts";
import type { Plan } from "./plan.ts";
import { loadKitVariables } from "./variables.ts";

/** The kit's glyph font: Inter for ⇧ and ⌘, which Roboto lacks (G1). */
export const GLYPH_FONT: GlyphFontSpec = { family: "Inter", glyphs: ["⇧", "⌘"] };

/** A variable a fixture file holds, with its value in the collection's one mode. */
export type FixtureVariable = {
  readonly collection: string;
  readonly name: string;
  readonly type: VariableType;
  readonly value: VariableValue;
};

/** The bytes of an image file, base64 encoded, and their SHA-1 in lowercase hex, as `shasum -a 1` gives it. */
export type ImageFixture = {
  readonly bytes: string;
  readonly sha1: string;
};

/** A complete 1 × 1 red PNG, which pngjs wrote, for an image fill. */
export const RED_PIXEL: ImageFixture = {
  bytes: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==",
  sha1: "176f91bcf3f65721b854f6e0f977230134860d15",
};

/** A complete 1 × 1 blue PNG, for an image fill whose bytes differ from the red one's. */
export const BLUE_PIXEL: ImageFixture = {
  bytes: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWNgYPj/HwADAgH/FAeIXAAAAABJRU5ErkJggg==",
  sha1: "4032015acdb969242695aef672b1c2c9f29b7b55",
};

/**
 * The first 100 bytes of Avatar's 96 × 96 portrait: the signature, the IHDR chunk and part of the
 * image data. A real file stored them on 2026-10-22 (P9b).
 */
export const PORTRAIT_HEAD: ImageFixture = {
  bytes:
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAFjElEQVR4nOycW0xcRRiA5+yesxcWllJ2VcAubbgUS6GVWjXaWipqNJpYo30waNOYGJ980Rjjm8YXfWh86YtPEg==",
  sha1: "f795b54d5a30ea3c271e50c06bec58093d8fc3ee",
};

/** A PNG's 8-byte signature alone, which a real file refused as `Image type is unsupported` (P9b). */
export const PNG_SIGNATURE: ImageFixture = {
  bytes: "iVBORw0KGgo=",
  sha1: "4caece539b039b16e16206ea2478f8c5ffb2ca05",
};

/** The start of a JPEG file: its SOI and JFIF APP0 markers. */
export const JPEG_HEAD: ImageFixture = {
  bytes: "/9j/4AAQSkZJRgABAQAAAQABAAA=",
  sha1: "152630b75949650726d58c1645884d7976c361ed",
};

/** {@link RED_PIXEL} with its IHDR width set to 4097, one past the 4096px Figma's reference allows. */
export const PNG_4097_WIDE: ImageFixture = {
  bytes: "iVBORw0KGgoAAAANSUhEUgAAEAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==",
  sha1: "548243127dc3e5e2493b4b6069c3ff52a72d79f0",
};

/** A FLOAT variable. */
export function float(collection: string, name: string, value: number): FixtureVariable {
  return { collection, name, type: "FLOAT", value: { _tag: "Float", value } };
}

/** A STRING variable. */
export function string(collection: string, name: string, value: string): FixtureVariable {
  return { collection, name, type: "STRING", value: { _tag: "String", value } };
}

/** A COLOR variable. */
export function color(collection: string, name: string, value: Rgba): FixtureVariable {
  return { collection, name, type: "COLOR", value: { _tag: "Color", color: value } };
}

/** A variable of the given type that aliases another variable of the file. */
export function aliasOf(
  collection: string,
  name: string,
  type: VariableType,
  target: VariableReference
): FixtureVariable {
  return { collection, name, type, value: { _tag: "Alias", target } };
}

/**
 * A synced file that holds the given variables, each collection in one mode, `Default`.
 *
 * @param variables - The variables.
 * @returns The file.
 */
export function fixtureFile(variables: readonly FixtureVariable[]): FakeFigma {
  const names = [...new Set(variables.map((variable) => variable.collection))];
  const collections = names.map((name): CollectionSpec => ({
    name,
    modes: ["Default"],
    variables: variables
      .filter((variable) => variable.collection === name)
      .map((variable) => ({
        name: variable.name,
        type: variable.type,
        scopes: [],
        webSyntax: undefined,
        description: "",
        values: new Map([["Default", variable.value]]),
      })),
  }));
  return createFakeFigma({ collections });
}

/**
 * The run a planner takes on a fixture file, with the file's collections as the kit's.
 *
 * @param file - The file.
 * @param plan - The plan the planner records into.
 * @returns The run.
 */
export async function fixtureRun(file: FakeFigma, plan: Plan): Promise<Run> {
  const collections = await file.figma.variables.getLocalVariableCollectionsAsync();
  const variables = await Effect.runPromise(
    loadKitVariables(file.figma, new Set(collections.map((collection) => collection.name)))
  );
  return { figma: file.figma, variables, plan, glyphFont: GLYPH_FONT };
}

/**
 * A child of a given type and name, which a test expects the parent to hold.
 *
 * @param parent - The node whose children to search.
 * @param type - The child's node type.
 * @param name - The child's name.
 * @returns The child, narrowed to its type.
 * @throws When the parent holds no such child.
 */
export function childNamed<Type extends SceneNode["type"]>(
  parent: ChildrenMixin,
  type: Type,
  name: string
): Extract<SceneNode, { readonly type: Type }> {
  const child = parent.children.find(
    (node): node is Extract<SceneNode, { readonly type: Type }> => node.type === type && node.name === name
  );
  if (child === undefined) {
    throw new Error(`no ${type} named ${name}`);
  }
  return child;
}

/**
 * The one child of a given type, for a test that reads the child's name, which a designer may have
 * changed.
 *
 * @param parent - The node whose children to search.
 * @param type - The child's node type.
 * @returns The child, narrowed to its type.
 * @throws When the parent holds no such child, or more than one.
 */
export function onlyChildOfType<Type extends SceneNode["type"]>(
  parent: ChildrenMixin,
  type: Type
): Extract<SceneNode, { readonly type: Type }> {
  const children = parent.children.filter(
    (node): node is Extract<SceneNode, { readonly type: Type }> => node.type === type
  );
  const [child] = children;
  if (child === undefined || children.length > 1) {
    throw new Error(`${String(children.length)} children of type ${type}, not one`);
  }
  return child;
}
