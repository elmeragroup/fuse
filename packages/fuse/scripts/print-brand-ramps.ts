/**
 * Prints the generated brand ramps as the literals `src/theme/tokens/brand-ramps.ts` commits.
 *
 *   node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/print-brand-ramps.ts
 */

import { generatedBrandRamps } from "./brand-ramp-recipe.ts";

for (const brand of ["elma", "ngfi"] as const) {
  process.stdout.write(`${brand}: ${JSON.stringify(generatedBrandRamps(brand), null, 2)}\n`);
}
