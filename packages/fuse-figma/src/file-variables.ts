/**
 * The Figma side of a sync. It covers what a file holds now and the changes one atomic
 * write makes. Ids are branded because one write mixes collection, mode and variable ids,
 * both real ones read from the file and temporary ones minted for new objects. A swapped
 * id would fail only inside Figma. `FigmaApi` owns the REST encoding of these changes.
 */

import { Brand } from "effect";

import type { LiteralValue, VariableScope, VariableType } from "./variable-set.ts";

/** A variable collection id, real or temporary. */
export type CollectionId = string & Brand.Brand<"CollectionId">;

/** Brand a collection id read from Figma or minted for a request. */
export const CollectionId = Brand.nominal<CollectionId>();

/** A mode id, real or temporary. */
export type ModeId = string & Brand.Brand<"ModeId">;

/** Brand a mode id read from Figma or minted for a request. */
export const ModeId = Brand.nominal<ModeId>();

/** A variable id, real or temporary. */
export type VariableId = string & Brand.Brand<"VariableId">;

/** Brand a variable id read from Figma or minted for a request. */
export const VariableId = Brand.nominal<VariableId>();

/** Figma's variable types. `BOOLEAN` can exist in a file even though the sync never writes it. */
export type FileVariableType = "BOOLEAN" | VariableType;

/** A value a write sets: a literal, or an alias to a variable by its real or temporary id. */
export type WriteValue = { readonly _tag: "Alias"; readonly id: VariableId } | LiteralValue;

/** One mode value as Figma stores it. */
export type FileValue =
  | WriteValue
  | { readonly _tag: "Boolean"; readonly value: boolean }
  // A color composed from aliased channels. The sync never writes one, so it always
  // differs from the value the sync wants.
  | { readonly _tag: "ComposedColor" };

/**
 * The code a developer writes for a variable on each platform, shown in Figma's code
 * panel. The keys are Figma's platform names, and a missing key means no entry.
 */
export type CodeSyntax = {
  readonly WEB?: string;
  readonly ANDROID?: string;
  readonly iOS?: string;
};

/** A local variable in the file. */
export type FileVariable = {
  readonly id: VariableId;
  readonly name: string;
  readonly type: FileVariableType;
  readonly scopes: readonly string[];
  readonly codeSyntax: CodeSyntax;
  readonly values: ReadonlyMap<ModeId, FileValue>;
};

/** A mode of a collection in the file. */
export type FileMode = {
  readonly id: ModeId;
  readonly name: string;
};

/** A local, non-extension collection in the file. */
export type FileCollection = {
  readonly id: CollectionId;
  readonly name: string;
  readonly modes: readonly FileMode[];
  readonly variables: readonly FileVariable[];
};

/**
 * The collections a sync can own. Remote collections, collection extensions, remote
 * variables and deleted-but-referenced variables are left out; the sync never edits them.
 */
export type FileVariables = {
  readonly collections: readonly FileCollection[];
};

/** A collection a write creates. Figma gives it one mode, which `initialModeId` names for the rest of the write. */
export type NewCollection = {
  readonly id: CollectionId;
  readonly name: string;
  readonly initialModeId: ModeId;
};

/**
 * A change to one mode of a collection. `NameInitialMode` names the one mode Figma gives a
 * collection the same write creates; it is the only mode a write renames.
 */
export type ModeChange =
  | {
      readonly _tag: "NameInitialMode" | "CreateMode";
      readonly collectionId: CollectionId;
      readonly id: ModeId;
      readonly name: string;
    }
  | { readonly _tag: "DeleteMode"; readonly collectionId: CollectionId; readonly id: ModeId };

/** The editable metadata the sync keeps in step on every variable it owns. */
export type VariableMetadata = {
  readonly scopes: readonly VariableScope[];

  /**
   * The complete code syntax the variable should end up with, every platform included.
   * `undefined` leaves the variable's code syntax as it is.
   */
  readonly codeSyntax: CodeSyntax | undefined;
};

/** A change to one variable. */
export type VariableChange =
  | {
      readonly _tag: "CreateVariable";
      readonly collectionId: CollectionId;
      readonly id: VariableId;
      readonly name: string;
      readonly type: VariableType;
      readonly metadata: VariableMetadata;
    }
  | { readonly _tag: "UpdateVariable"; readonly id: VariableId; readonly metadata: VariableMetadata }
  | { readonly _tag: "DeleteVariable"; readonly id: VariableId };

/** One mode value a write sets. */
export type ValueChange = {
  readonly variableId: VariableId;
  readonly modeId: ModeId;
  readonly value: WriteValue;
};

/**
 * One atomic write. Figma applies the lists in this order, and each list in order, so a
 * value may reference a mode or variable created earlier in the same write.
 */
export type ChangeBatch = {
  readonly collections: readonly NewCollection[];
  readonly modes: readonly ModeChange[];
  readonly variables: readonly VariableChange[];
  readonly values: readonly ValueChange[];
};
