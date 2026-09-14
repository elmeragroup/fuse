import { parseStyleRules } from "./css-rules";

export const LIBRARY_COMFORTABLE_SELECTOR = ':root[data-density="comfortable"]';
// Stamped by apps/docs/src/components/demo-stage.tsx; the docs browser first-paint test verifies the pairing against the shipped CSS.
export const DEMO_STAGE_COMFORTABLE_SELECTOR = '[data-demo-stage][data-density="comfortable"]';

const GENERATED_FILE_HEADER = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Re-scopes the library :root[data-density="comfortable"] block onto [data-demo-stage].
 */

`;

export function generateDemoStageComfortableCss(uiCss: string): string {
  const atTheme = uiCss.indexOf("@theme");
  const source = atTheme === -1 ? uiCss : uiCss.slice(0, atTheme);
  const rule = parseStyleRules(source).find((entry) => entry.selector === LIBRARY_COMFORTABLE_SELECTOR);
  if (rule === undefined || rule.declarations.length === 0) {
    throw new Error(`failed to extract ${LIBRARY_COMFORTABLE_SELECTOR} from ui.css`);
  }
  const body = rule.declarations
    .map((declaration) => `  --${declaration.name}: ${declaration.value};`)
    .join("\n");
  return `${GENERATED_FILE_HEADER}${DEMO_STAGE_COMFORTABLE_SELECTOR} {\n${body}\n}\n`;
}
