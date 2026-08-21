import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const LIBRARY_CSS_FROM_ROOT = join("packages", "ui", "src", "styles", "ui.css");

// Turbopack virtualizes import.meta in PostCSS-transform chunks, so the library CSS is
// located relative to the processed stylesheet's real filesystem path instead.
function findLibraryCssPath(fromFile: string): string {
  let dir = dirname(fromFile);
  for (;;) {
    const candidate = join(dir, LIBRARY_CSS_FROM_ROOT);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`could not locate ${LIBRARY_CSS_FROM_ROOT} from ${fromFile}`);
    }
    dir = parent;
  }
}

export const LIBRARY_COMFORTABLE_SELECTOR = ':root[data-density="comfortable"]';
export const DEMO_STAGE_COMFORTABLE_SELECTOR = '.DemoStage[data-density="comfortable"]';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractRuleBlock(css: string, selector: string): string {
  const match = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "s").exec(css);
  const block = match?.[1];
  if (block === undefined) {
    throw new Error(`failed to extract ${selector} from packages/ui/src/styles/ui.css`);
  }
  return block;
}

/**
 * Derive the DemoStage-scoped comfortable density declarations from the library block.
 * Library density CSS stays :root-anchored; the docs preview sandbox needs the same
 * custom properties on a nested element, so this re-scopes the single source of truth.
 */
export function deriveDemoStageComfortableCss(uiCss: string): string {
  const block = extractRuleBlock(uiCss, LIBRARY_COMFORTABLE_SELECTOR);
  return `${DEMO_STAGE_COMFORTABLE_SELECTOR} {${block}}`;
}

type PostCssPlugin = {
  postcssPlugin: "elmera-demo-stage-density";
  Once(root: {
    source?: { input?: { file?: string } };
    append(node: string): void;
  }): void;
};

/**
 * PostCSS plugin: append the derived block while DemoFrame.css is processed, so the
 * committed stylesheet never carries hand-copied density metrics.
 */
export default function elmeraDemoStageDensity(): PostCssPlugin {
  return {
    postcssPlugin: "elmera-demo-stage-density",
    Once(root) {
      const file = root.source?.input?.file ?? "";
      if (!file.endsWith("DemoFrame.css")) {
        return;
      }
      root.append(
        deriveDemoStageComfortableCss(readFileSync(findLibraryCssPath(file), "utf8"))
      );
    },
  };
}
