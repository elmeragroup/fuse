import axe from "axe-core";
import { expect } from "vitest";

/**
 * axe-core rules a component suite leaves out. `color-contrast` reads the rendered colours, which
 * the theme suites check against the role tokens; `region` wants every node in a landmark, which a
 * component fixture is not.
 */
const AXE_PAGE_RULES = ["color-contrast", "region"] as const;

/**
 * Runs axe-core over `root` and fails with each violation's rule and the elements it found, so a
 * suite catches invalid ARIA that role and name queries cannot see: an attribute the role does not
 * support, a list that owns something other than list items, a region without a name.
 *
 * @param root - The rendered fixture, such as the element `renderThemed` returns as `host`.
 * @param knownRules - Rules a suite leaves out for a recorded reason, each named in `TODO.md`.
 */
export async function assertNoAxeViolations(
  root: Element,
  knownRules: readonly string[] = []
): Promise<void> {
  const rules = Object.fromEntries(
    [...AXE_PAGE_RULES, ...knownRules].map((rule) => [rule, { enabled: false }] as const)
  );
  const { violations } = await axe.run(root, { resultTypes: ["violations"], rules });
  expect(
    violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(" ")).join(", ")}`)
  ).toEqual([]);
}
