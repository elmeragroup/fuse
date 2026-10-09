import { DENSITIES } from "./density";
import { DENSITY_METRIC_NAMES, DENSITY_METRICS } from "./tokens/density-metrics";

const GENERATED_FILE_HEADER = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Re-scopes the library density blocks onto [data-demo-stage].
 */

`;

/**
 * The docs demo-stage stylesheet. It declares each density's metrics on `[data-demo-stage]`,
 * so a preview can use another density than the document. It reads `DENSITY_METRICS`, which
 * the `fuse.css` density blocks must equal.
 *
 * @returns The stylesheet source.
 */
export function generateDemoStageDensityCss(): string {
  const blocks = DENSITIES.map((density) => {
    const body = DENSITY_METRIC_NAMES.map((name) => `  --${name}: ${DENSITY_METRICS[name][density]};`).join(
      "\n"
    );
    // Stamped by apps/docs/src/components/demo-stage.tsx, the landing's density stage and its Dashboard; the docs browser first-paint test verifies the pairing against the shipped CSS.
    return `[data-demo-stage][data-density="${density}"] {\n${body}\n}\n`;
  });
  return `${GENERATED_FILE_HEADER}${blocks.join("\n")}`;
}
