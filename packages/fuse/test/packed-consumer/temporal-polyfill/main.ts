// A consumer entry that imports the polyfill bare, as the docs tell hosts to. Node runs the built
// bundle with `remove-native-temporal.mjs` preloaded, so the report reads what the bundle
// installed whether or not that Node ships Temporal.
import "@elmeragroup/fuse/temporal-polyfill";

console.log(
  JSON.stringify({
    sum:
      "Temporal" in globalThis
        ? globalThis.Temporal.PlainDate.from("2026-02-28").add({ days: 1 }).toString()
        : null,
    marker: Symbol.for("@elmeragroup/fuse/temporal") in globalThis,
  })
);
