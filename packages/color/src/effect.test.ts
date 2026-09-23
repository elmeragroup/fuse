import { Effect, Exit, Result } from "effect";
import { describe, expect, it } from "vitest";

import * as CssColor from "./css-color.ts";
import * as ColorEffect from "./effect.ts";
import { InvalidColor } from "./invalid-color.ts";

describe("toEffect", () => {
  it("fails an Effect program with a tagged error it can recover from", () => {
    const program = Effect.gen(function* () {
      const color = yield* ColorEffect.toEffect(CssColor.parse("oklch(0.5 0.1)"));
      return CssColor.toSrgb(color);
    }).pipe(Effect.catchTag("InvalidColor", (error) => Effect.succeed(error.notation)));
    expect(Effect.runSyncExit(program)).toEqual(Exit.succeed("oklch"));
  });

  it("succeeds with the parsed color", () => {
    const program = Effect.map(ColorEffect.toEffect(CssColor.parse("#5c6773")), CssColor.toSrgb);
    expect(Effect.runSync(program)).toMatchObject({ r: 92 / 255, g: 103 / 255, b: 115 / 255, alpha: 1 });
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
