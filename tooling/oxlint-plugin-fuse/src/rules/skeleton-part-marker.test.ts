import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ruleTester } from "../rule-tester.ts";
import { skeletonPartMarker } from "./skeleton-part-marker.ts";

const directory = mkdtempSync(join(tmpdir(), "fuse-skeleton-roles-"));
const roles = join(directory, "skeleton-roles.ts");
writeFileSync(
  roles,
  `export const PART_SKELETON = {
  badge: "block",
  loader: "ignore",
} as const satisfies Record<string, SkeletonRole>;
`
);
const options = [{ roles }];

ruleTester.run("skeleton-part-marker", skeletonPartMarker, {
  valid: [
    {
      code: '<span data-slot="badge" {...props} data-skeleton-part={"badge" satisfies SkeletonPart} />',
      options,
    },
    { code: '<div {...props} data-slot="loader" data-skeleton-part="loader" />', options },
    // A slot without a role needs no marker.
    { code: '<div data-slot="card" {...props} />', options },
    // A slot chosen at runtime is not read.
    { code: "<div data-slot={slot} {...props} />", options },
    { code: '<span data-slot="badge" {...props} />', options, filename: "badge.test.tsx" },
    // A render element's props win over the part's, so its slot replaces the part's and needs no marker.
    { code: '<Button render={<a data-slot="loader" href="/" />} />', options },
    {
      code: 'useRender({ props: { "data-slot": "badge", ...props, "data-skeleton-part": "badge" satisfies SkeletonPart } });',
      options,
    },
    {
      code: 'useRender({ props: { "data-slot": "badge", ...mergeProps<"span">({ className }, props), "data-skeleton-part": "badge" } });',
      options,
    },
    // A later `mergeProps` argument wins, so the marker may sit in another object than the slot.
    {
      code: 'useRender({ props: mergeProps({ "data-slot": "badge" }, props, { "data-skeleton-part": "badge" }) });',
      options,
    },
    { code: 'useRender({ props: { "data-slot": "card", ...props } });', options },
    // `useRender` state is stamped as `data-slot` but cannot carry the marker.
    { code: 'useRender({ state: { slot: "badge" }, props });', options },
  ],
  invalid: [
    { code: '<span data-slot="badge" {...props} />', options, errors: [{ messageId: "missing" }] },
    {
      code: '<span data-slot="badge" {...props} data-skeleton-part={"loader" satisfies SkeletonPart} />',
      options,
      errors: [{ messageId: "mismatch" }],
    },
    {
      code: '<div data-slot="card" data-skeleton-part="badge" />',
      options,
      errors: [{ messageId: "mismatch" }],
    },
    {
      code: '<span data-slot="badge" data-skeleton-part={part} />',
      options,
      errors: [{ messageId: "mismatch" }],
    },
    {
      code: '<span data-slot="badge" data-skeleton-part={"badge" satisfies SkeletonPart} {...props} />',
      options,
      errors: [{ messageId: "beforeSpread" }],
    },
    {
      code: 'useRender({ props: { "data-slot": "badge", ...props } });',
      options,
      errors: [{ messageId: "missingProperty" }],
    },
    {
      code: 'useRender({ props: mergeProps({ "data-slot": "badge", className }, props) });',
      options,
      errors: [{ messageId: "missingProperty" }],
    },
    {
      code: 'useRender({ props: { "data-slot": "badge", ...props, "data-skeleton-part": "loader" } });',
      options,
      errors: [{ messageId: "mismatch" }],
    },
    {
      code: 'useRender({ props: mergeProps({ "data-slot": "badge", "data-skeleton-part": "badge" }, props) });',
      options,
      errors: [{ messageId: "beforeSpread" }],
    },
    {
      code: '<span data-slot="badge" />',
      options: [{ roles: join(directory, "missing.ts") }],
      errors: [{ messageId: "table" }],
    },
  ],
});
