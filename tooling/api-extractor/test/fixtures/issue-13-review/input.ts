/**
 * Workspace-owned regression fixture for the Issue 13 export-root boundary.
 * Both declarations originate in a vendored dependency, but their bare
 * interface/value roots intentionally remain anonymous empty objects under the
 * current TypeScript 7 policy.
 */
export type { BareInterface } from "issue-13-root-dependency";
export { bareValue } from "issue-13-root-dependency";

export type { Array as ProjectArray } from "./src/typescript/lib/lib.dom.js";
export type { ReadonlyArray as ProjectReadonlyArray } from "./src/@typescript/tsc/lib/lib.es2022.js";

export type ProjectArrayUse = import("./src/typescript/lib/lib.dom.js").Array<string>;
export type ProjectReadonlyArrayUse = import("./src/@typescript/tsc/lib/lib.es2022.js").ReadonlyArray<string>;
export type ProjectExtractUse = import("./src/typescript/lib/lib.dom.js").Extract<
  keyof { value: string; other: boolean },
  string
>;
