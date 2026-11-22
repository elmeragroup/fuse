/**
 * An in-memory Figma file the token sync wrote, every combination of its modes, and the page stamps
 * that show each combination in Chromium, for the suites that check a built length in every mode.
 */
import { Effect, Result } from "effect";
import { TestConsole } from "effect/testing";

import { FILE_KEY, run, TOKEN } from "../../test/cli-fixture.ts";
import { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { parsePreviewTheme, themeStamps } from "../compare/preview-theme.ts";
import type { ThemeStamps } from "../compare/preview-theme.ts";
import type { NumberSpec } from "./kit-spec.ts";

/** A frame's mode for each collection of the file, by collection name. */
export type Pin = Readonly<Record<string, string>>;

/** A synced file, each of its pins, and the page stamps of each pin in the same order. */
export type SyncedPins = {
  readonly figma: InMemoryFigma;
  readonly pins: readonly Pin[];
  readonly stamps: readonly ThemeStamps[];
};

/** Every combination of the file's collection modes, one mode per collection. */
function everyPin(figma: InMemoryFigma): readonly Pin[] {
  return figma
    .collectionNames()
    .reduce<readonly Pin[]>(
      (pins, collection) =>
        pins.flatMap((pin) => figma.modeNames(collection).map((mode) => ({ ...pin, [collection]: mode }))),
      [{}]
    );
}

/**
 * Sync the Fuse tokens into an in-memory file and list every combination of its modes, each with the
 * attributes `test:compare` stamps on the page to show it.
 *
 * @returns The file, its pins and their stamps.
 * @throws When a pin names a mode the preview theme does not parse, a defect in the sync.
 */
export async function syncedPins(): Promise<SyncedPins> {
  const figma = new InMemoryFigma(FILE_KEY, TOKEN);
  await Effect.runPromise(
    run(figma, ["--file-key", FILE_KEY, "sync"]).pipe(Effect.provide(TestConsole.layer))
  );
  const pins = everyPin(figma);
  const stamps = pins.map((pin) => {
    const theme = parsePreviewTheme(Object.entries(pin).map(([collection, mode]) => ({ collection, mode })));
    if (Result.isFailure(theme)) {
      throw new Error(theme.failure.message);
    }
    return themeStamps(theme.success);
  });
  return { figma, pins, stamps };
}

/**
 * A FLOAT field as the file resolves it under a frame's pin. A variable that resolves to no number
 * never equals Chromium's pixels, so its mismatch line shows what it holds.
 *
 * @param figma - The synced file.
 * @param spec - The field's value in the spec.
 * @param pin - The frame's modes.
 * @returns The value the file renders.
 */
export function pixels(
  figma: InMemoryFigma,
  spec: NumberSpec,
  pin: Pin
): ReturnType<InMemoryFigma["resolve"]> {
  return spec.kind === "literal"
    ? spec.value
    : figma.resolve(spec.variable.collection, spec.variable.name, pin);
}

/**
 * A pin's modes, joined for a mismatch line.
 *
 * @param pin - The pin.
 * @returns Its modes, in collection order.
 */
export function pinName(pin: Pin): string {
  return Object.values(pin).join(" / ");
}
