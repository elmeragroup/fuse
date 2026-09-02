import { fileURLToPath } from "node:url";

import { fixtureEvidenceCatalog, validateFixtureEvidenceCatalog } from "./fixture-catalog.ts";
import { packageFixtureExecutionPlan, packageFixtureTypecheckPlan } from "./fixture-plans.ts";

export function checkFixtureCatalog() {
  validateFixtureEvidenceCatalog(fixtureEvidenceCatalog);
  if (packageFixtureExecutionPlan.length !== fixtureEvidenceCatalog.length) {
    throw new Error("Package fixture execution plan is incomplete.");
  }
  return {
    fixtures: packageFixtureExecutionPlan.length,
    conformance: packageFixtureExecutionPlan.filter((entry) => entry.conformance).length,
    timed: packageFixtureExecutionPlan.filter((entry) => entry.timing.length > 0).length,
    warningEvidence: packageFixtureExecutionPlan.filter((entry) => entry.warningEvidence).length,
    typecheckProjects: packageFixtureTypecheckPlan.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({ ...checkFixtureCatalog(), status: "pass" }));
}
