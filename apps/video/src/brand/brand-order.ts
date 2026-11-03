import { BRAND_CODES } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

/** Every brand in the order the films show them: Elmera first, then Fuse's order, as the landing's strip runs. */
export const FILM_BRAND_ORDER: readonly BrandCode[] = [
  "elma",
  ...BRAND_CODES.filter((brand) => brand !== "elma"),
];
