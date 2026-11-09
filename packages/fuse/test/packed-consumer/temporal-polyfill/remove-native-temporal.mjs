// Preloaded before the consumer bundle, so the bundle meets a runtime without Temporal. Node 26
// ships Temporal, so a removal that left it in place would let the run pass on Node's own.
if (!Reflect.deleteProperty(globalThis, "Temporal") || "Temporal" in globalThis) {
  throw new Error("The packed temporal-polyfill consumer needs a runtime without Temporal.");
}
