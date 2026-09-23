import { DENSITY_METRIC_NAMES, DENSITY_METRICS } from "./tokens/density-metrics";

// Stamped by apps/docs/src/components/demo-stage.tsx; the docs browser first-paint test verifies the pairing against the shipped CSS.
export const DEMO_STAGE_COMFORTABLE_SELECTOR = '[data-demo-stage][data-density="comfortable"]';

const GENERATED_FILE_HEADER = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Re-scopes the library :root[data-density="comfortable"] block onto [data-demo-stage].
 */

`;

/**
 * The docs demo-stage stylesheet. It declares the comfortable density metrics on
 * `[data-demo-stage]`, so a preview can use another density than the document. It reads
 * `DENSITY_METRICS`, which the `fuse.css` comfortable block must equal.
 *
 * @returns The stylesheet source.
 */
export function generateDemoStageComfortableCss(): string {
  const body = DENSITY_METRIC_NAMES.map((name) => `  --${name}: ${DENSITY_METRICS[name].comfortable};`).join(
    "\n"
  );
  return `${GENERATED_FILE_HEADER}${DEMO_STAGE_COMFORTABLE_SELECTOR} {\n${body}\n}\n`;
}
