import type { Plugin } from "@oxlint/plugins";

import { chartDemoTable } from "./rules/chart-demo-table.ts";
import { declaredDensityRole } from "./rules/declared-density-role.ts";
import { definedPropsWiring } from "./rules/defined-props-wiring.ts";
import { namespaceIndexExports } from "./rules/namespace-index-exports.ts";
import { noBaseUiPreviewMenu } from "./rules/no-base-ui-preview-menu.ts";
import { noClassAssertions } from "./rules/no-class-assertions.ts";
import { noColorLiteral } from "./rules/no-color-literal.ts";
import { noDisplayNameAssignment } from "./rules/no-display-name-assignment.ts";
import { noFixedDelay } from "./rules/no-fixed-delay.ts";
import { noGeometryAssertions } from "./rules/no-geometry-assertions.ts";
import { noHookCalls } from "./rules/no-hook-calls.ts";
import { noSourceReadingTests } from "./rules/no-source-reading-tests.ts";
import { noTestRetry } from "./rules/no-test-retry.ts";
import { noThemeColorWrite } from "./rules/no-theme-color-write.ts";
import { noUseClient } from "./rules/no-use-client.ts";
import { noWallClock } from "./rules/no-wall-clock.ts";
import { oneBrowserTestPerModule } from "./rules/one-browser-test-per-module.ts";
import { overlayRootOverrideLast } from "./rules/overlay-root-override-last.ts";
import { ownedClassTokens } from "./rules/owned-class-tokens.ts";
import { renderElementWiring } from "./rules/render-element-wiring.ts";
import { requireDisableReason } from "./rules/require-disable-reason.ts";
import { restrictedImports } from "./rules/restricted-imports.ts";
import { sideOverlayState } from "./rules/side-overlay-state.ts";
import { stateFace } from "./rules/state-face.ts";

/**
 * The repo's own lint rules: the source contracts Fuse holds its modules to, and the shapes a test
 * may not take. `oxlint.config.ts` loads this module by path and scopes each rule through its
 * overrides.
 */
const plugin: Plugin = {
  meta: { name: "fuse" },
  rules: {
    "chart-demo-table": chartDemoTable,
    "declared-density-role": declaredDensityRole,
    "defined-props-wiring": definedPropsWiring,
    "namespace-index-exports": namespaceIndexExports,
    "no-base-ui-preview-menu": noBaseUiPreviewMenu,
    "no-color-literal": noColorLiteral,
    "no-class-assertions": noClassAssertions,
    "no-display-name-assignment": noDisplayNameAssignment,
    "no-fixed-delay": noFixedDelay,
    "no-hook-calls": noHookCalls,
    "no-geometry-assertions": noGeometryAssertions,
    "no-source-reading-tests": noSourceReadingTests,
    "no-test-retry": noTestRetry,
    "no-theme-color-write": noThemeColorWrite,
    "no-use-client": noUseClient,
    "no-wall-clock": noWallClock,
    "one-browser-test-per-module": oneBrowserTestPerModule,
    "overlay-root-override-last": overlayRootOverrideLast,
    "owned-class-tokens": ownedClassTokens,
    "render-element-wiring": renderElementWiring,
    "require-disable-reason": requireDisableReason,
    "restricted-imports": restrictedImports,
    "side-overlay-state": sideOverlayState,
    "state-face": stateFace,
  },
};

export default plugin;
