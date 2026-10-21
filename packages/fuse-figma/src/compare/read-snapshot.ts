/**
 * Parse the JSON the plugin's "Export snapshots" button downloads into a {@link KitSnapshot}.
 */

import { Result, Schema } from "effect";

import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from "./snapshot.ts";
import type { KitSnapshot } from "./snapshot.ts";

const CanvasRect = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  width: Schema.Finite,
  height: Schema.Finite,
});

const KitSnapshotSchema = Schema.Struct({
  format: Schema.Literal(SNAPSHOT_FORMAT),
  version: Schema.Literal(SNAPSHOT_VERSION),
  exportedAt: Schema.String,
  file: Schema.String,
  scale: Schema.Finite,
  previews: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      name: Schema.String,
      modes: Schema.Array(Schema.Struct({ collection: Schema.String, mode: Schema.String })),
      instances: Schema.Array(
        Schema.Struct({
          key: Schema.String,
          variant: Schema.String,
          box: CanvasRect,
          image: Schema.NullOr(Schema.Struct({ renderBounds: CanvasRect, png: Schema.String })),
        })
      ),
    })
  ),
});

const decode: (text: string) => Result.Result<KitSnapshot, Schema.SchemaError> = Schema.decodeUnknownResult(
  Schema.fromJsonString(KitSnapshotSchema)
);

/** The file is not a snapshot this version of `figma:compare` reads. */
class SnapshotUnreadable extends Error {
  readonly _tag = "SnapshotUnreadable" as const;
}

/**
 * Parse a snapshot file's text.
 *
 * @param text - The file's contents.
 * @returns The snapshot, or `SnapshotUnreadable` with the schema's account of what is wrong.
 */
export function parseSnapshot(text: string): Result.Result<KitSnapshot, SnapshotUnreadable> {
  return Result.mapError(
    decode(text),
    (error) =>
      new SnapshotUnreadable(
        `The file is not a ${SNAPSHOT_FORMAT} version ${String(SNAPSHOT_VERSION)} export: ${error.message}`
      )
  );
}
