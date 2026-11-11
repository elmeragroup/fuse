import type { Plugin } from "@oxlint/plugins";

import { declaredDensityRole } from "./rules/declared-density-role.ts";
import { definedPropsWiring } from "./rules/defined-props-wiring.ts";
import { namespaceIndexExports } from "./rules/namespace-index-exports.ts";
import { noBaseUiPreviewMenu } from "./rules/no-base-ui-preview-menu.ts";
import { noColorLiteral } from "./rules/no-color-literal.ts";
import { noDisplayNameAssignment } from "./rules/no-display-name-assignment.ts";
import { noThemeColorWrite } from "./rules/no-theme-color-write.ts";
import { noUseClient } from "./rules/no-use-client.ts";
import { overlayRootOverrideLast } from "./rules/overlay-root-override-last.ts";
import { ownedClassTokens } from "./rules/owned-class-tokens.ts";
import { renderElementWiring } from "./rules/render-element-wiring.ts";
import { requireDisableReason } from "./rules/require-disable-reason.ts";
import { restrictedImports } from "./rules/restricted-imports.ts";
import { stateFace } from "./rules/state-face.ts";

/**
 * The repo's own lint rules: the source contracts Fuse holds its modules to. `.oxlintrc.json`
 * loads this module by path and scopes each rule through its overrides.
 */
const plugin: Plugin = {
  meta: { name: "fuse" },
  rules: {
    "declared-density-role": declaredDensityRole,
    "defined-props-wiring": definedPropsWiring,
    "namespace-index-exports": namespaceIndexExports,
    "no-base-ui-preview-menu": noBaseUiPreviewMenu,
    "no-color-literal": noColorLiteral,
    "no-display-name-assignment": noDisplayNameAssignment,
    "no-theme-color-write": noThemeColorWrite,
    "no-use-client": noUseClient,
    "overlay-root-override-last": overlayRootOverrideLast,
    "owned-class-tokens": ownedClassTokens,
    "render-element-wiring": renderElementWiring,
    "require-disable-reason": requireDisableReason,
    "restricted-imports": restrictedImports,
    "state-face": stateFace,
  },
};

export default plugin;
