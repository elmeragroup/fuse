import type { Density } from "@elmeragroup/fuse/theme";

import type { ArtboardScheme } from "./documents";

/** An artboard scheme as the studio names it in toggles and readouts. */
export const SCHEME_LABELS = { light: "Light", dark: "Dark" } as const satisfies Record<
  ArtboardScheme,
  string
>;

/** A density as the studio names it in toggles and readouts. */
export const DENSITY_LABELS = { dense: "Dense", comfortable: "Comfortable" } as const satisfies Record<
  Density,
  string
>;
