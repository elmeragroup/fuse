import { Effect, Exit, Result } from "effect";
import { describe, expect, it } from "vitest";

import * as CssColor from "./css-color.ts";
import * as ColorEffect from "./effect.ts";
import { InvalidColor } from "./invalid-color.ts";

describe("toEffect", () => {
  it("succeeds with the parsed color and fails with a tagged error a program can recover from", () => {
    const success = Effect.map(ColorEffect.toEffect(CssColor.parse("#5c6773")), CssColor.toSrgb);
    expect(Effect.runSync(success)).toMatchObject({ r: 92 / 255, g: 103 / 255, b: 115 / 255, alpha: 1 });
    const failure = Effect.gen(function* () {
      const color = yield* ColorEffect.toEffect(CssColor.parse("oklch(0.5 0.1)"));
      return CssColor.toSrgb(color);
    }).pipe(Effect.catchTag("InvalidColor", (error) => Effect.succeed(error.notation)));
    expect(Effect.runSyncExit(failure)).toEqual(Exit.succeed("oklch"));
  });
});

describe("toResult", () => {
  it("carries a success and a failure into Effect's Result", () => {
    const success = ColorEffect.toResult(CssColor.parse("#ffffff"));
    expect(Result.isSuccess(success) && success.success).toMatchObject({ r: 1, g: 1, b: 1, alpha: 1 });
    const failure = ColorEffect.toResult(CssColor.parse("white"));
    expect(Result.isFailure(failure) && failure.failure).toBeInstanceOf(InvalidColor);
  });
});
