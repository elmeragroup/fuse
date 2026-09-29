import { test } from "vitest";

import { Field } from "@elmeragroup/fuse/field";

test("Root takes the three-value orientation axis, Legend the two-value variant axis, and parts useRender's render prop but never a polymorphic as prop", () => {
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

  const _control = <Field.Control render={<textarea />} />;
  const _label = <Field.Label render={<span />} />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Field.Root as="fieldset" />;
});
