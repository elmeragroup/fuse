import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

RuleTester.describe = describe;
RuleTester.it = it;

/**
 * A RuleTester that reports through Vitest and parses every case as TSX module code unless the
 * case names its own file.
 */
export const ruleTester = new RuleTester({
  languageOptions: { sourceType: "module", parserOptions: { lang: "tsx" } },
});
