import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ServerConfig } from "../src/config.ts";

// Unit under test: the settings layer, read from an environment. Oracle: the token bucket's
// definition in token-bucket.ts. A call takes one whole token, so a burst that is not a positive
// whole number would refuse every call or admit fewer than it says, and startup must name the
// setting that is wrong.

/** The settings read from `env`, or the message startup fails with. */
const settingsFrom = (env: Record<string, string>) =>
  Effect.service(ServerConfig).pipe(
    Effect.provide(
      ServerConfig.layer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))))
    ),
    Effect.mapError((error) => error.message),
    Effect.result
  );

describe("ServerConfig", () => {
  it.effect("fails startup on a tool-call burst that is not a positive whole number, naming it", () =>
    Effect.gen(function* () {
      for (const burst of ["0.5", "2.5", "0", "-3", "many"]) {
        const result = yield* settingsFrom({ FUSE_TOOL_CALL_BURST: burst });
        assert.strictEqual(result._tag, "Failure", burst);
        if (result._tag === "Failure") assert.include(result.failure, "FUSE_TOOL_CALL_BURST", burst);
      }
    })
  );

  it.effect("reads a whole burst and a fractional refill rate", () =>
    Effect.gen(function* () {
      const result = yield* settingsFrom({ FUSE_TOOL_CALL_BURST: "3", FUSE_TOOL_CALLS_PER_SECOND: "0.5" });
      assert.strictEqual(result._tag, "Success");
      if (result._tag === "Success") {
        assert.deepStrictEqual(result.success.toolCalls, { refillPerSecond: 0.5, burst: 3 });
      }
    })
  );
});
