/**
 * JSON text for the files the runner writes and the requests it sends.
 */

import * as Schema from "effect/Schema";

/**
 * Encodes a value as JSON text, indented by two spaces. A value JSON cannot hold, such as a
 * `bigint`, fails with a `SchemaError` instead of throwing.
 */
export const encodeJsonText = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown, { space: 2 }));
