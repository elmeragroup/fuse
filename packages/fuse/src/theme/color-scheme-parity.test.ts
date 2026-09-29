import { describe, expect, it } from "vitest";

import { runColorSchemeBootstrap } from "../../test/memory-color-scheme-platform";
import type { MemoryPlatformInit } from "../../test/memory-color-scheme-platform";
import { resolveColorSchemeOptions } from "./color-scheme";
import type { ColorSchemeOptions } from "./color-scheme";
import { createBrowserColorSchemePlatform } from "./color-scheme-browser-platform";
import { createColorSchemeRuntime } from "./color-scheme-runtime";
import type { ColorSchemeRuntimeConfig } from "./color-scheme-runtime";
import { colorSchemeScriptSource } from "./color-scheme-script";
import type { ColorScheme, ResolvedColorScheme } from "./color-scheme-types";

// Unit under test: createColorSchemeRuntime's resolution and write gate on connect.
// Oracle: the serialized ColorSchemeScript bootstrap (colorSchemeScriptSource run in a vm over
// the memory host), a separate closed implementation that color-scheme-script.test.ts pins
// with its own hand-written tables. Both run over the same simulated platform, so a runtime
// that mounts over its own bootstrap and still writes has resolved differently. The anchor
// rows below also pin the oracle itself to hand-written values.

const DEFAULT_KEY = "elmera-color-scheme";

function connectRuntime(
  options: ColorSchemeOptions,
  platform: Parameters<typeof createColorSchemeRuntime>[1]
) {
  const config: ColorSchemeRuntimeConfig = {
    ...resolveColorSchemeOptions(options),
    disableTransitionOnChange: false,
    nonce: undefined,
  };
  const runtime = createColorSchemeRuntime(config, platform);
  runtime.configure(config);
  runtime.connect();
  return runtime;
}

type Fixture = {
  stored: string | undefined;
  prefersDark: boolean;
  enableSystem: boolean;
  defaultColorScheme: ColorScheme;
  forcedColorScheme: ColorScheme | undefined;
  storage: "available" | "blocked";
  media: "modern" | "missing" | "throwing";
};

function fixtures(): Fixture[] {
  const rows: Fixture[] = [];
  for (const stored of [undefined, "light", "dark", "system", "sepia"]) {
    for (const prefersDark of [false, true]) {
      for (const enableSystem of [true, false]) {
        for (const defaultColorScheme of ["light", "dark", "system"] as const) {
          for (const forcedColorScheme of [undefined, "light", "dark", "system"] as const) {
            for (const storage of ["available", "blocked"] as const) {
              for (const media of ["modern", "missing", "throwing"] as const) {
                rows.push({
                  stored,
                  prefersDark,
                  enableSystem,
                  defaultColorScheme,
                  forcedColorScheme,
                  storage,
                  media,
                });
              }
            }
          }
        }
      }
    }
  }
  return rows;
}

function describeFixture(fixture: Fixture): string {
  return [
    `stored=${fixture.stored ?? "none"}`,
    `dark=${String(fixture.prefersDark)}`,
    `system=${String(fixture.enableSystem)}`,
    `default=${fixture.defaultColorScheme}`,
    `forced=${fixture.forcedColorScheme ?? "none"}`,
    `storage=${fixture.storage}`,
    `media=${fixture.media}`,
  ].join(" ");
}

function platformInit(fixture: Fixture): MemoryPlatformInit {
  return {
    stored: fixture.stored === undefined ? {} : { [DEFAULT_KEY]: fixture.stored },
    prefersDark: fixture.prefersDark,
    storage: fixture.storage,
    media: fixture.media,
  };
}

function fixtureOptions(fixture: Fixture): ColorSchemeOptions {
  return {
    enableSystem: fixture.enableSystem,
    defaultColorScheme: fixture.defaultColorScheme,
    forcedColorScheme: fixture.forcedColorScheme,
  };
}

describe.each(fixtures().map((fixture) => [describeFixture(fixture), fixture] as const))(
  "bootstrap and runtime parity: %s",
  (_name, fixture) => {
    const options = fixtureOptions(fixture);
    const source = colorSchemeScriptSource(options);

    it("agrees through the browser adapter over the same host", () => {
      const shared = runColorSchemeBootstrap(source, platformInit(fixture));

      connectRuntime(options, createBrowserColorSchemePlatform(shared.host));

      expect(shared.state.rootWrites).toHaveLength(1);
    });
  }
);

const ANCHORS: Array<{
  name: string;
  options: ColorSchemeOptions;
  stored: Record<string, string>;
  prefersDark: boolean;
  expected: ResolvedColorScheme;
}> = [
  {
    name: "defaults, nothing stored, light OS",
    options: {},
    stored: {},
    prefersDark: false,
    expected: "light",
  },
  { name: "defaults, nothing stored, dark OS", options: {}, stored: {}, prefersDark: true, expected: "dark" },
  {
    name: "stored light beats a dark OS",
    options: {},
    stored: { [DEFAULT_KEY]: "light" },
    prefersDark: true,
    expected: "light",
  },
  {
    name: "an invalid stored value falls back to system",
    options: {},
    stored: { [DEFAULT_KEY]: "blue" },
    prefersDark: true,
    expected: "dark",
  },
  {
    name: "stored system with system support off",
    options: { enableSystem: false },
    stored: { [DEFAULT_KEY]: "system" },
    prefersDark: true,
    expected: "light",
  },
  {
    name: "defaultColorScheme dark",
    options: { defaultColorScheme: "dark" },
    stored: {},
    prefersDark: false,
    expected: "dark",
  },
  {
    name: "a custom key ignores the default key",
    options: { storageKey: "app" },
    stored: { [DEFAULT_KEY]: "dark" },
    prefersDark: false,
    expected: "light",
  },
  {
    name: "forced light beats stored dark",
    options: { forcedColorScheme: "light" },
    stored: { [DEFAULT_KEY]: "dark" },
    prefersDark: true,
    expected: "light",
  },
  {
    name: "forced system follows the OS",
    options: { forcedColorScheme: "system" },
    stored: { [DEFAULT_KEY]: "light" },
    prefersDark: true,
    expected: "dark",
  },
  {
    name: "an illegal default normalizes to system",
    // SAFETY: untyped host input can carry an out-of-union default; both sides normalize it.
    options: { defaultColorScheme: "blue" as ColorScheme },
    stored: {},
    prefersDark: true,
    expected: "dark",
  },
];

describe("bootstrap and runtime anchors", () => {
  it.each(ANCHORS)(
    "both resolve the hand-written value: $name",
    ({ options, stored, prefersDark, expected }) => {
      const shared = runColorSchemeBootstrap(colorSchemeScriptSource(options), { stored, prefersDark });
      expect(shared.state.root).toBe(expected);

      const runtime = connectRuntime(options, shared.platform);

      expect(runtime.getSnapshot().resolvedColorScheme).toBe(expected);
      expect(shared.state.rootWrites).toEqual([{ value: expected, transition: undefined }]);
    }
  );
});
