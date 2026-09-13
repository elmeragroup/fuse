import { Schema } from "effect";

/** Mirrors the release engine's own JSON boundary: decode external text, never assert it. */
export function decodeJson<A>(text: string, schema: Schema.Codec<A>, label: string): A {
  try {
    return Schema.decodeUnknownSync(schema)(JSON.parse(text));
  } catch (error) {
    const problem = error instanceof SyntaxError ? "is not valid JSON" : "is invalid";
    throw new Error(`${label} ${problem}`, { cause: error });
  }
}
