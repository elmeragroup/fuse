import type { Plugin } from "@oxlint/plugins";

import { chartDemoTable } from "./rules/chart-demo-table.ts";
import { containerSurface } from "./rules/container-surface.ts";
import { declaredDensityRole } from "./rules/declared-density-role.ts";
import { definedPropsWiring } from "./rules/defined-props-wiring.ts";
import { jsdocVoice } from "./rules/jsdoc-voice.ts";
import { motionSafeTransform } from "./rules/motion-safe-transform.ts";
import { namespaceIndexExports } from "./rules/namespace-index-exports.ts";
import { noBaseUiPreviewMenu } from "./rules/no-base-ui-preview-menu.ts";
import { noColorLiteral } from "./rules/no-color-literal.ts";
import { noDataSlotSelector } from "./rules/no-data-slot-selector.ts";
import { noDisplayNameAssignment } from "./rules/no-display-name-assignment.ts";
import { noHookCalls } from "./rules/no-hook-calls.ts";
import { noHostInCheck } from "./rules/no-host-in-check.ts";
import { noKeptWindowCleanup } from "./rules/no-kept-window-cleanup.ts";
import { noRingShadowRead } from "./rules/no-ring-shadow-read.ts";
import { noTempDirAtCollection } from "./rules/no-temp-dir-at-collection.ts";
import { noThemeColorWrite } from "./rules/no-theme-color-write.ts";
import { noUseClient } from "./rules/no-use-client.ts";
import { oneBrowserTestPerModule } from "./rules/one-browser-test-per-module.ts";
import { overlayRootOverrideLast } from "./rules/overlay-root-override-last.ts";
import { ownedClassTokens } from "./rules/owned-class-tokens.ts";
import { renderElementWiring } from "./rules/render-element-wiring.ts";
import { restrictedImports } from "./rules/restricted-imports.ts";
import { sideOverlayState } from "./rules/side-overlay-state.ts";
import { skeletonPartMarker } from "./rules/skeleton-part-marker.ts";
import { stateFace } from "./rules/state-face.ts";
import { surfaceMutedForeground } from "./rules/surface-muted-foreground.ts";

/**
 * The repo's own lint rules: the source contracts Fuse holds its modules to, and the shapes a test
 * may not take. `oxlint.config.ts` loads this module by path and scopes each rule through its
 * overrides.
 */
const plugin: Plugin = {
  meta: { name: "fuse" },
  rules: {
    "chart-demo-table": chartDemoTable,
    "container-surface": containerSurface,
    "declared-density-role": declaredDensityRole,
    "defined-props-wiring": definedPropsWiring,
    "jsdoc-voice": jsdocVoice,
    "motion-safe-transform": motionSafeTransform,
    "namespace-index-exports": namespaceIndexExports,
    "no-base-ui-preview-menu": noBaseUiPreviewMenu,
    "no-color-literal": noColorLiteral,
    "no-data-slot-selector": noDataSlotSelector,
    "no-display-name-assignment": noDisplayNameAssignment,
    "no-hook-calls": noHookCalls,
    "no-host-in-check": noHostInCheck,
    "no-kept-window-cleanup": noKeptWindowCleanup,
    "no-ring-shadow-read": noRingShadowRead,
    "no-temp-dir-at-collection": noTempDirAtCollection,
    "no-theme-color-write": noThemeColorWrite,
    "no-use-client": noUseClient,
    "one-browser-test-per-module": oneBrowserTestPerModule,
    "overlay-root-override-last": overlayRootOverrideLast,
    "owned-class-tokens": ownedClassTokens,
    "render-element-wiring": renderElementWiring,
    "restricted-imports": restrictedImports,
    "side-overlay-state": sideOverlayState,
    "skeleton-part-marker": skeletonPartMarker,
    "state-face": stateFace,
    "surface-muted-foreground": surfaceMutedForeground,
  },
};

export default plugin;
