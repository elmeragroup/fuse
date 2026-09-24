# @elmeragroup/color

Color parsing, conversion, mixing and contrast for the workspace. The theme pipeline mixes derived roles and gates text contrast with it. The Figma sync and the docs DTCG export convert tokens to sRGB with it. The browser suites read the colors Chromium computes with it. It is a private workspace package with no build step, so consumers import its TypeScript source.

## Modules

The core modules have no dependencies. Import each one by its subpath, as a namespace, such as `import * as Oklch from "@elmeragroup/color/oklch"`.

| Subpath                        | Owns                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `@elmeragroup/color/oklch`     | The `Oklch` type, `oklch()` parse and format, CSS `color-mix(in oklch)` mixing, conversion to sRGB    |
| `@elmeragroup/color/srgb`      | The gamma-encoded `Srgb` and linear-light `LinearSrgb` types, `rgb()` parsing, transfer, compositing  |
| `@elmeragroup/color/hex`       | Six-digit hex, `#rrggbb` in and uppercase `#RRGGBB` out                                               |
| `@elmeragroup/color/css-color` | One parser for every notation the package reads, including `lab()`, and conversion to sRGB            |
| `@elmeragroup/color/wcag`      | WCAG 2.2 relative luminance and contrast ratio                                                        |
| `@elmeragroup/color/result`    | The `Result`, `Ok` and `Err` types every fallible function returns, and `getOrThrow` for defect paths |
| `@elmeragroup/color/effect`    | The Effect adapter, `toEffect` and `toResult`                                                         |

The `lab()` parser and the CIE Lab conversion live in `src/lab.ts` without a subpath, because callers only meet `lab()` as a computed color that `css-color` reads. The errors `InvalidColor` and `OutOfRange` have no subpath either. The modules that return them re-export their types, so a caller can name one, as in `import type { InvalidColor } from "@elmeragroup/color/css-color"`, and reads its `_tag`, `message` and fields from a result. `css-color` also re-exports the `Lab` type. The exports are type-only, so they give no caller a way to construct an error or a `Lab`. The `ok` and `err` constructors stay internal, so only the package builds a result.

Each color is an instance of a class with readonly `_tag` and component fields, a private constructor and an ES private brand field. Only the package's parsers, its math and the `make` smart constructors produce one, and each checks every component first. A spread copy such as `{ ...color, h: 720 }` lacks the private field, so the compiler rejects it where a color is expected. An `Oklch` has lightness and alpha in `0..1`, a chroma in `0..1e6` and a hue in `0..360`, 360 exclusive. A `Lab` has its `a` and `b` axes within ±1e6. Those bounds lie far outside any display gamut and far inside the range where the conversion math stays finite, so every color a parser returns converts to sRGB. An `Srgb` sits inside the gamut. A `LinearSrgb` has finite channels that may leave it. `Srgb` and `LinearSrgb` are different classes, so the compiler rejects a linear color where a function expects an encoded one.

## Using it

A parser returns `Result<Color, InvalidColor>`, a tagged union of `{ _tag: "ok", value }` and `{ _tag: "err", error }`. The errors are `Error` subclasses with a `_tag`.

```ts
import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";

const parsed = CssColor.parse("oklch(0.4848 0.16637 35.92)");
if (parsed._tag === "ok") {
  Hex.formatOpaque(CssColor.toSrgb(parsed.value)); // "#A82C00"
}
```

Where a malformed value is a defect rather than input, such as a literal in a token module, unwrap it with `getOrThrow` from `@elmeragroup/color/result`. The call throws the `InvalidColor`.

`@elmeragroup/color/effect` is the package's Effect adapter. An Effect program converts there and recovers by tag.

```ts
import * as CssColor from "@elmeragroup/color/css-color";
import * as ColorEffect from "@elmeragroup/color/effect";
import { Effect } from "effect";

const toSrgbOrLog = (input: string) =>
  ColorEffect.toEffect(CssColor.parse(input)).pipe(
    Effect.map(CssColor.toSrgb),
    Effect.catchTag("InvalidColor", (error) => Effect.logWarning(error.message))
  );
```

`toResult` returns Effect's own `Result` instead. The Figma sync reads token colors through it.

## Where it runs

The core imports nothing and uses no Node or DOM global. An oxlint override in the root `.oxlintrc.json` fails an `effect` import anywhere in `src` except `src/effect.ts` and the tests. Its `tsconfig.json` leaves both type libraries out, so a runtime-specific call fails the type check. A minified bundle of `css-color`, which reaches every module except the Effect bridge, is about 2.3 kB gzipped. `effect` is an optional peer dependency that only the `effect` subpath imports, so a browser page that parses colors never loads it. A browser app outside this workspace would need the package built to JavaScript first, because it ships TypeScript source today.

An `InvalidColor` keeps no copy of the rejected input, and its message quotes at most the first 64 characters. The regular expressions stay linear on long input. A server can therefore parse colors from untrusted requests without the errors it logs carrying the whole request.

## Scope

The package reads only the color forms the workspace uses and refuses the rest.

- `oklch(L C H)` and `oklch(L C H / A)`, with plain numbers and an alpha written as a number or a percentage. The theme tokens and Chromium's computed values use this form.
- `lab(L a b)` and `lab(L a b / A)`, with plain numbers, as Chromium serializes them.
- `rgb(r, g, b)` and `rgba(r, g, b, a)`, the legacy comma form Chromium serializes, with channels from 0 to 255 and a number alpha.
- Six-digit `#rrggbb` hex, the form of the hex tokens.

Out-of-range lightness, alpha and channels clamp as CSS clamps them at parse time. The parsers refuse percentages outside an `oklch()` alpha, angle units, the space-separated `rgb()` form, shorthand and eight-digit hex, the `none` keyword, named colors and other color functions. The package writes `oklch()` and six-digit hex. Its math covers OKLCH mixing, sRGB gamut clipping, compositing, and WCAG 2 luminance and contrast. Add a form, a notation or a space when a caller needs it, with tests against published reference values.
