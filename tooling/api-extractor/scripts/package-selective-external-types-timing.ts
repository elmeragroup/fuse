import { Effect } from "effect";
import { resolve } from "node:path";

import {
  extractModuleWithTiming,
  InternalProjectExtractorTiming,
  timedProjectExtractorLayer,
} from "../src/internal/timing.ts";

const maxRoundTripMs = 1_000;
const fixtureRoot = resolve(import.meta.dirname, "../test/fixtures/package-selective-external-types");
const inputPath = resolve(fixtureRoot, "input.ts");
const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");

if (process.argv[2] !== "--check") {
  throw new Error("Use --check to verify package-selective external-type timing.");
}

const extraction = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const timing = yield* InternalProjectExtractorTiming;
      return yield* extractModuleWithTiming(timing, inputPath, {
        includeExternalTypes: ["@fixture/selected"],
      });
    }).pipe(Effect.provide(timedProjectExtractorLayer({ tsconfigPath })))
  )
);

const component = extraction.result.module.exports.find(
  (candidate) => candidate.name === "PrimitiveComponent"
);
if (component?.type.kind !== "component") {
  throw new Error("The representative selective-expansion component was not recognized.");
}
const props = new Map(component.type.props.map((property) => [property.name, property]));
if (props.has("prefixedPackageProp")) {
  throw new Error("Selective expansion entered an unselected same-prefix package.");
}
if (props.get("foreignDetail")?.type.kind !== "external") {
  throw new Error("Selective expansion entered an unselected dependency graph.");
}
const actionType = props.get("onAction")?.type;
if (actionType?.kind !== "union" || actionType.types[0]?.kind !== "external") {
  throw new Error("Selective expansion entered the React or DOM graph.");
}
if (!extraction.timing.enabled || extraction.timing.totals.roundTripMs > maxRoundTripMs) {
  throw new Error(
    `Selective expansion exceeded the ${maxRoundTripMs}ms round-trip limit: ${extraction.timing.totals.roundTripMs}ms.`
  );
}

console.log(
  JSON.stringify({
    fixture: "package-selective-external-types",
    selectedPackage: "@fixture/selected",
    roundTripMs: extraction.timing.totals.roundTripMs,
    maxRoundTripMs,
    requestCount: extraction.timing.totals.requestCount,
    props: [...props.keys()],
  })
);
