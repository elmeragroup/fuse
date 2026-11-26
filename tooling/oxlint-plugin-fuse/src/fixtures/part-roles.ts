/** The density table `declared-density-role.test.ts` lints against, in `density-roles.ts`'s shape. */
export const PART_DENSITY = {
  button: "control",
  "card-header": "surface",
  "sidebar-group:where([data-collapsible=icon] *)": "fixed",
} as const satisfies Readonly<Record<string, string>>;

/** The skeleton table `skeleton-part-marker.test.ts` lints against, in `skeleton-roles.ts`'s shape. */
export const PART_SKELETON = {
  badge: "block",
  loader: "ignore",
} as const satisfies Readonly<Record<string, string>>;
