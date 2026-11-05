import { assetTitleSlot, serverSafeAsset } from "./asset-rules.ts";
import {
  BROWSER_SUITE_OWNERS,
  browserSuiteHarness,
  locateByRole,
  noRingShadowInSuites,
} from "./browser-suite-rules.ts";
import {
  CHART_OWNERS,
  chartMotionPlacement,
  chartMotionWriter,
  chartPartDisplayName,
  noChartColourLiteral,
} from "./chart-rules.ts";
import { ALLOWED_VAGUE_MODULES, noVagueModuleName } from "./module-name-rule.ts";
import { requireOwners } from "./rule-kit.ts";
import type { Plugin } from "./rule-kit.ts";
import {
  SOURCE_OWNERS,
  basePreviewMenu,
  requiredImport,
  noObjectStringTag,
  noRefSnapshotPath,
  noRetiredUserAgentApi,
  overlayClassesOwner,
  renderElementWiring,
} from "./source-rules.ts";

/**
 * The repository's own oxlint plugin: per-file source rules that the external `elmera` plugin does
 * not own. `.oxlintrc.json` loads it by path and scopes each rule to the files it governs; owner
 * modules a rule exempts are named in the rule beside its message, and the plugin refuses to load
 * in a tree that no longer holds one. test/fuse-lint-rules.test.mjs lints fixtures under the real
 * configuration.
 */
requireOwners([...CHART_OWNERS, ...BROWSER_SUITE_OWNERS, ...SOURCE_OWNERS, ...ALLOWED_VAGUE_MODULES]);

const plugin: Plugin = {
  meta: { name: "fuse" },
  rules: {
    "asset-title-slot": assetTitleSlot,
    "base-ui-preview-menu": basePreviewMenu,
    "browser-suite-harness": browserSuiteHarness,
    "chart-motion-placement": chartMotionPlacement,
    "chart-motion-writer": chartMotionWriter,
    "chart-part-display-name": chartPartDisplayName,
    "is-text-node-import": requiredImport,
    "locate-by-role": locateByRole,
    "no-chart-colour-literal": noChartColourLiteral,
    "no-object-string-tag": noObjectStringTag,
    "no-ref-snapshot-path": noRefSnapshotPath,
    "no-retired-user-agent-api": noRetiredUserAgentApi,
    "no-ring-shadow-in-suites": noRingShadowInSuites,
    "no-vague-module-name": noVagueModuleName,
    "overlay-classes-owner": overlayClassesOwner,
    "render-element-wiring": renderElementWiring,
    "required-import": requiredImport,
    "server-safe-asset": serverSafeAsset,
  },
};

export default plugin;
