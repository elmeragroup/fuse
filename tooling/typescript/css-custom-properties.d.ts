/**
 * Inline `--*` custom properties are typed once here instead of at each call site.
 *
 * See `docs/spec/tooling.md` §4 for the lint rationale behind this augmentation.
 *
 * The empty export marks this file as a module: in a script, `declare module "csstype"` would
 * shadow the library's own types instead of augmenting them.
 */
export {};

declare module "csstype" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- csstype's documented augmentation point is interface declaration merging; a type alias cannot augment.
  interface Properties {
    /** Inline `--*` custom properties, forwarded unchanged by React to the style attribute. */
    [customProperty: `--${string}`]: string | number | undefined;
  }
}
