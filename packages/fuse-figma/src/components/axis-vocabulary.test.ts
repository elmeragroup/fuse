/**
 * The names of the kit's variant axes.
 *
 * Unit under test: every axis of every kit manifest, by name and values.
 * Oracles, each written apart from the axes:
 *
 * - The docs' generated API reference of the parts the set's manifest says it draws, which must list
 *   them: an axis named as a prop of one of
 *   those parts mirrors that prop, so it lists only the prop's values, a boolean prop's as `false`
 *   and `true`.
 * - The hand-written Figma-only vocabulary: any other axis takes a name it lists, and only values
 *   it lists for that name.
 */
import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import { readFileSync } from "node:fs";

import { BOOLEAN_VALUES, FIGMA_AXES } from "./axis-vocabulary.ts";
import { KIT } from "./kit-registry.ts";

const ApiReference = Schema.Struct({
  parts: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      props: Schema.Array(
        Schema.Struct({
          name: Schema.String,
          type: Schema.String,
          values: Schema.optionalKey(Schema.Array(Schema.String)),
        })
      ),
    })
  ),
});

type ApiProp = (typeof ApiReference.Type)["parts"][number]["props"][number];

/** The parts of a docs page's API reference, by name. */
function apiParts(page: string): ReadonlyMap<string, readonly ApiProp[]> {
  const path = new URL(`../../../../apps/docs/src/app/(docs)/components/${page}/api.json`, import.meta.url);
  const reference = Schema.decodeUnknownSync(ApiReference)(JSON.parse(readFileSync(path, "utf8")));
  return new Map(reference.parts.map((part) => [part.name, part.props]));
}

/**
 * The values a prop takes as the reference states them: its resolved `values`, `false` and `true`
 * for a boolean, or the string literals of its type. Undefined for a type that names neither, which
 * no axis may mirror.
 */
function propValues(prop: ApiProp): readonly string[] | undefined {
  if (prop.values !== undefined) {
    return prop.values;
  }
  if (/^boolean( \| undefined)?$/u.test(prop.type)) {
    return BOOLEAN_VALUES;
  }
  const literals = [...prop.type.matchAll(/"([^"]*)"/gu)].map((match) => match[1] ?? "");
  return literals.length === 0 ? undefined : literals;
}

describe.each(KIT.map(({ manifest }) => [manifest.key, manifest] as const))(
  "the set %s",
  (_key, manifest) => {
    const source = manifest.api;
    const parts = apiParts(source.page);

    it("draws parts its component's API reference lists", () => {
      expect(source.parts.filter((part) => !parts.has(part))).toEqual([]);
    });

    it.each(manifest.axes.map((axis) => [axis.name, axis] as const))(
      "lists only the values its axis %s may take",
      (name, axis) => {
        const props = source.parts.flatMap((part) =>
          (parts.get(part) ?? []).filter((prop) => prop.name === name)
        );
        const allowed =
          props.length > 0
            ? props.flatMap((prop) => propValues(prop) ?? [])
            : (FIGMA_AXES.get(name)?.values ?? []);
        expect({
          name,
          mirrors: props.length > 0,
          values: axis.values.filter((value) => !allowed.includes(value)),
        }).toEqual({
          name,
          mirrors: props.length > 0,
          values: [],
        });
        if (props.length === 0) {
          expect(FIGMA_AXES.has(name)).toBe(true);
        }
      }
    );
  }
);
