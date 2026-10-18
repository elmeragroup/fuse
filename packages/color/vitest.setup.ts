import * as fc from "fast-check";

// One fixed seed for every property test in the package, so a run, and a Stryker run per
// mutant, draws the same samples each time.
fc.configureGlobal({ seed: 20261018 });
