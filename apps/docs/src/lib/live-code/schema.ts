/**
 * Live code lets a reader set the props of a part that take a finite set of values. The Turbopack
 * loader reads them from the committed `api.json` and inlines them into each demo, and the Code
 * view reads them back from the parts that rendered.
 */

/** One prop the Code view can set: an enum with its options, or a boolean. */
export type PropSpec =
  | {
      readonly name: string;
      readonly kind: "enum";
      readonly values: readonly string[];
      /** The authored default, when it is one of `values`. */
      readonly default?: string;
      /**
       * The alternatives a value needs beside it, keyed by value, from `api.json`'s `requires`.
       * Each alternative is a list of props, and any one of them is enough.
       */
      readonly requires?: Readonly<Record<string, readonly (readonly string[])[]>>;
    }
  | {
      readonly name: string;
      readonly kind: "boolean";
      /** The authored default, when the part declares one. */
      readonly default?: boolean;
    };

/** A part's settable props, in `api.json` order. */
export type PartSchema = readonly PropSpec[];

/** The fields of an `api.json` prop row this derivation reads. */
export type ApiPropRow = {
  readonly name: string;
  readonly type: string;
  readonly values?: readonly string[];
  readonly requires?: Readonly<Record<string, readonly (readonly string[])[]>>;
  readonly defaultValue: string | null;
};

/**
 * Props a reader sets through other means than a value list: wiring (`children`, handlers),
 * styling, and the controlled or uncontrolled state a demo owns.
 */
const UNSETTABLE =
  /^(?:className|style|children|ref|key|id|nativeButton|keepMounted|loopFocus|tabIndex|checked|pressed|value|open)$|^(?:aria-|data-|on[A-Z]|default[A-Z])/u;

/**
 * Props that swap the element a part renders rather than style it. A demo's content is written
 * for its element, so another one breaks it, as `elementType="input"` breaks a Text with children.
 */
const ELEMENT_PROPS: ReadonlySet<string> = new Set(["render", "elementType"]);

/** An authored default the Code view can show: a string literal or a boolean literal. */
type LiteralDefault =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "none" };

/** The authored default as a literal, or `none` when it is an expression or absent. */
function literalDefault(defaultValue: string | null): LiteralDefault {
  if (defaultValue === "true" || defaultValue === "false") {
    return { kind: "boolean", value: defaultValue === "true" };
  }
  const quoted = /^(["'])(.*)\1$/u.exec(defaultValue ?? "");
  return quoted?.[2] === undefined ? { kind: "none" } : { kind: "string", value: quoted[2] };
}

/**
 * The props of one part a reader can set from the Code view: each enum `api.json` lists `values`
 * for, and each boolean.
 *
 * @param props - The part's `api.json` prop rows.
 * @returns Its settable props, in row order.
 */
export function partSchema(props: readonly ApiPropRow[]): PartSchema {
  const specs: PropSpec[] = [];
  for (const prop of props) {
    if (UNSETTABLE.test(prop.name) || ELEMENT_PROPS.has(prop.name)) continue;
    const fallback = literalDefault(prop.defaultValue);
    if (prop.values !== undefined) {
      const base: PropSpec = { name: prop.name, kind: "enum", values: prop.values };
      const spec = prop.requires === undefined ? base : { ...base, requires: prop.requires };
      // Only an authored default counts. An option that happens to be named `default` is not the
      // default when the artifact records none: Calendar's month buttons render `ghost`.
      specs.push(
        fallback.kind === "string" && prop.values.includes(fallback.value)
          ? { ...spec, default: fallback.value }
          : spec
      );
    } else if (prop.type === "boolean" || prop.type === "boolean | undefined") {
      const spec: PropSpec = { name: prop.name, kind: "boolean" };
      specs.push(fallback.kind === "boolean" ? { ...spec, default: fallback.value } : spec);
    }
  }
  return specs;
}

/**
 * The options of an enum a site can take without failing the part's props type. A value is
 * offered when it needs nothing, or when the site passes every prop of one of its alternatives.
 * Button's `size="icon"` needs `aria-label`, so a site without one is not offered the icon sizes.
 * The site's current value stays on offer whatever it needs, so the list never comes up empty.
 *
 * @param spec - The enum prop.
 * @param passed - The props the site passes: those its source writes and those the reader set.
 * @param current - The value the site renders the prop with, or `undefined`.
 * @returns The allowed values, in `spec.values` order.
 */
export function allowedValues(
  spec: Extract<PropSpec, { kind: "enum" }>,
  passed: ReadonlySet<string>,
  current: string | boolean | undefined
): readonly string[] {
  return spec.values.filter((value) => {
    const alternatives = spec.requires?.[value];
    return (
      value === current ||
      alternatives === undefined ||
      alternatives.some((needs) => needs.every((name) => passed.has(name)))
    );
  });
}
