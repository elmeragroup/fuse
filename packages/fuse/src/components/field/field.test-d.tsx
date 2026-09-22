import { expectTypeOf, test } from "vitest";

import type { Field as RootField } from "@elmeragroup/fuse";
import { Field } from "@elmeragroup/fuse/field";

test("the namespace ships all twelve parts from the field entry and the root barrel", () => {
  expectTypeOf<typeof Field>().toEqualTypeOf<typeof RootField>();
  expectTypeOf(Field).toHaveProperty("Root");
  expectTypeOf(Field).toHaveProperty("Label");
  expectTypeOf(Field).toHaveProperty("Description");
  expectTypeOf(Field).toHaveProperty("Error");
  expectTypeOf(Field).toHaveProperty("Control");
  expectTypeOf(Field).toHaveProperty("Item");
  expectTypeOf(Field).toHaveProperty("Content");
  expectTypeOf(Field).toHaveProperty("Group");
  expectTypeOf(Field).toHaveProperty("Set");
  expectTypeOf(Field).toHaveProperty("Legend");
  expectTypeOf(Field).toHaveProperty("Separator");
  expectTypeOf(Field).toHaveProperty("Title");
});

test("Root takes the three-value orientation axis and Legend the two-value variant axis", () => {
  const _vertical = <Field.Root orientation="vertical" />;
  const _horizontal = <Field.Root orientation="horizontal" />;
  const _responsive = <Field.Root orientation="responsive" />;
  const _legend = <Field.Legend variant="label" />;
  const _legendDefault = <Field.Legend variant="legend" />;

  // @ts-expect-error orientation is the three public values only
  const _badOrientation = <Field.Root orientation="inline" />;
  // @ts-expect-error the legend axis is legend | label
  const _badLegend = <Field.Legend variant="title" />;
  // @ts-expect-error fieldVariants is package-private; no size axis exists
  const _noSize = <Field.Root size="sm" />;
});

test("parts take useRender's render prop and never a polymorphic as prop", () => {
  const _control = <Field.Control render={<textarea />} />;
  const _label = <Field.Label render={<span />} />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Field.Root as="fieldset" />;
});
