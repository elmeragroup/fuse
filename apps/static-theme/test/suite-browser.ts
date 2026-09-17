/**
 * The static-theme suites run against their own fixture pages, so they take only the
 * docs-agnostic suite-browser lifecycle: one headless Chromium per file, with no docs
 * server module in the import graph.
 */
export { launchSuiteBrowser } from "../../docs/test/suite-browser";
