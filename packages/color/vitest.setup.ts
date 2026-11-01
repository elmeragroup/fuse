import * as fc from "fast-check";

// One fixed seed for every property test in the package, so every run draws the same samples.
fc.configureGlobal({ seed: 20261018 });
