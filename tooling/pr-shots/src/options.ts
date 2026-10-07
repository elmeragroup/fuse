/**
 * The command line's meaning: what one `pnpm shots` run captures. The schemas here decode each
 * flag's text into its domain value, so the `Command` in `cli.ts` hands the run a `ShotOptions`
 * without touching the network, the disk or a browser.
 */

import { Effect, Result, Schema, SchemaGetter, SchemaIssue } from "effect";
import type { Page } from "playwright";

/** An ARIA role as Playwright's `getByRole` accepts it. */
type PlaywrightRole = Parameters<Page["getByRole"]>[0];

/**
 * The roles `--target` accepts. Every entry type-checks against Playwright's own role union, so
 * the list cannot name a role `getByRole` would reject.
 */
const ARIA_ROLES = [
  "alert",
  "alertdialog",
  "application",
  "article",
  "banner",
  "blockquote",
  "button",
  "caption",
  "cell",
  "checkbox",
  "code",
  "columnheader",
  "combobox",
  "complementary",
  "contentinfo",
  "definition",
  "deletion",
  "dialog",
  "directory",
  "document",
  "emphasis",
  "feed",
  "figure",
  "form",
  "generic",
  "grid",
  "gridcell",
  "group",
  "heading",
  "img",
  "insertion",
  "link",
  "list",
  "listbox",
  "listitem",
  "log",
  "main",
  "marquee",
  "math",
  "meter",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "navigation",
  "none",
  "note",
  "option",
  "paragraph",
  "presentation",
  "progressbar",
  "radio",
  "radiogroup",
  "region",
  "row",
  "rowgroup",
  "rowheader",
  "scrollbar",
  "search",
  "searchbox",
  "separator",
  "slider",
  "spinbutton",
  "status",
  "strong",
  "subscript",
  "superscript",
  "switch",
  "tab",
  "table",
  "tablist",
  "tabpanel",
  "term",
  "textbox",
  "time",
  "timer",
  "toolbar",
  "tooltip",
  "tree",
  "treegrid",
  "treeitem",
] as const satisfies readonly PlaywrightRole[];

/** The public docs deployment, rebuilt on every merge to main. */
export const PROD_ORIGIN = "https://fuse.elmeragroup.no";

/** An ARIA role `--target` may name. */
export const AriaRole = Schema.Literals(ARIA_ROLES);

/** An ARIA role `--target` may name. */
export type AriaRole = typeof AriaRole.Type;

/** The element a shot is about, found by role and accessible name like a user would. */
export const Target = Schema.Struct({
  /** The element's ARIA role. */
  role: AriaRole,
  /** The element's exact accessible name. */
  name: Schema.NonEmptyString,
});

/** The element a shot is about. */
export type Target = typeof Target.Type;

/** One `--click` step: the element to click, found like a target, and which match to take. */
export const ClickStep = Schema.Struct({
  /** The element's ARIA role. */
  role: AriaRole,
  /** The element's exact accessible name. */
  name: Schema.NonEmptyString,
  /** Which match to click when several share the role and name, counting from 0. */
  nth: Schema.Int,
});

/** One `--click` step. */
export type ClickStep = typeof ClickStep.Type;

/** The variants a theme slug may name, with the label the docs theme picker shows. */
const VARIANT_LABELS = { internal: "Internal", external: "External" } as const;

/** The segments a theme slug may name, with the label the docs theme picker shows. */
const SEGMENT_LABELS = { private: "Private", company: "Company" } as const;

/** A theme variant. */
export type Variant = keyof typeof VARIANT_LABELS;

/** A theme segment. */
export type Segment = keyof typeof SEGMENT_LABELS;

/** The theme a shot renders the demo stage in. */
export const ThemeChoice = Schema.Union([
  /** Leave the page's preview theme as it loads. */
  Schema.TaggedStruct("page-default", {}),
  /** Pick a theme through the header theme picker. */
  Schema.TaggedStruct("picked", {
    /** The slug as given, such as `external-tkas-company`. */
    slug: Schema.String,
    /** The variant part of the slug. */
    variant: Schema.Literals(["internal", "external"]),
    /** The brand code part of the slug. */
    brand: Schema.String,
    /** The segment part of the slug. */
    segment: Schema.Literals(["private", "company"]),
  }),
]);

/** The theme a shot renders the demo stage in. */
export type ThemeChoice = typeof ThemeChoice.Type;

/** A control density. */
export const Density = Schema.Literals(["dense", "comfortable"]);

/** A control density. */
export type Density = typeof Density.Type;

/** The density a shot renders the demo stage in. */
export const DensityChoice = Schema.Union([
  /** The deployment default the demo stage takes from the theme's variant. */
  Schema.TaggedStruct("stage-default", {}),
  /** A `data-density` value stamped on the demo stage, overriding the docs default. */
  Schema.TaggedStruct("override", { density: Density }),
]);

/** The density a shot renders the demo stage in. */
export type DensityChoice = typeof DensityChoice.Type;

/** A Playwright browser engine. */
export const Engine = Schema.Literals(["chromium", "webkit", "firefox"]);

/** A Playwright browser engine. */
export type Engine = typeof Engine.Type;

/**
 * What a shot covers. `stage` is the target's closest demo stage and `target` the element
 * itself, both padded and widened to any popup a control in them holds open. `viewport` is the
 * browser window at the top of the page, or after click steps where they and the fill left it,
 * and `page` the whole document. `auto` picks one of them when the run starts.
 */
export type Frame = "auto" | ResolvedFrame;

/** A frame after `auto` has been resolved: what the shots of a run actually cover. */
export type ResolvedFrame = "stage" | "target" | "viewport" | "page";

/** A browser window size in CSS pixels. */
export const Viewport = Schema.Struct({
  /** The width. */
  width: Schema.Int,
  /** The height. */
  height: Schema.Int,
});

/** A browser window size in CSS pixels. */
export type Viewport = typeof Viewport.Type;

/** The window every shot was taken in before `--viewports` existed, and still the default. */
export const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 900 };

/** The color scheme the browser reports to the page. */
export type ColorScheme = "light" | "dark";

/** Where a set of screenshots comes from. */
export const Source = Schema.Union([
  /** A server that is already running, such as prod or a preview deployment. */
  Schema.TaggedStruct("remote", {
    /** The origin the route is resolved against. */
    origin: Schema.URL,
    /** How the table and the log name the source: `prod` or the origin itself. */
    label: Schema.String,
  }),
  /** The docs app from this checkout, started for the run and stopped afterwards. */
  Schema.TaggedStruct("local", {}),
]);

/** Where a set of screenshots comes from. */
export type Source = typeof Source.Type;

/** A list flag's entries: never empty. */
type NonEmpty<T> = readonly [T, ...T[]];

/** Everything one run captures, parsed from the command line. */
export type ShotOptions = {
  /** The run's name: the output directory and the PR-body marker. */
  readonly name: string;
  /** The docs path to open, starting with `/`. */
  readonly route: string;
  /** The element the shot is about, or `null` for a page without one. */
  readonly target: Target | null;
  /** Which match of the target to take, counting from 0. */
  readonly nth: number;
  /** The elements to click, in order, after the theme is picked and before the shot. */
  readonly clicks: readonly ClickStep[];
  /** Text typed into the target before the shot, or `null` to leave it alone. */
  readonly fill: string | null;
  /** What the clip covers. */
  readonly frame: Frame;
  /** CSS pixels added around the frame on every side. */
  readonly pad: number;
  /** The themes to capture, in order. */
  readonly themes: NonEmpty<ThemeChoice>;
  /** The densities to capture, in order. */
  readonly densities: NonEmpty<DensityChoice>;
  /** The engines to capture with, in order. */
  readonly engines: NonEmpty<Engine>;
  /** The window sizes to capture at, in order. */
  readonly viewports: NonEmpty<Viewport>;
  /** The device scale factor. */
  readonly scale: number;
  /** The color scheme the browser reports. */
  readonly colorScheme: ColorScheme;
  /** Where the "before" shots come from. */
  readonly before: Source;
  /** Where the "after" shots come from. */
  readonly after: Source;
  /** Whether each before/after pair gets a pixel diff. */
  readonly diff: "on" | "off";
  /** pixelmatch's matching threshold, 0 to 1; smaller is more sensitive. */
  readonly threshold: number;
  /** The pull request to upload to, or `null` to only print the upload command. */
  readonly pr: number | null;
};

/**
 * A codec from a flag's text to a domain value. The CLI only decodes, so encoding is refused.
 * A parse failure becomes the issue message, which the CLI prints after the flag and the value.
 */
function fromText<S extends Schema.Top>(
  to: S,
  parse: (input: string) => Result.Result<S["Encoded"], string>
) {
  return Schema.String.pipe(
    Schema.decodeTo(to, {
      decode: SchemaGetter.transformEffect((input: string, options) =>
        Result.match(parse(input), {
          onSuccess: (value) => Effect.succeed(value),
          onFailure: (message) => Effect.fail(new SchemaIssue.InvalidValue({ message }, input, options)),
        })
      ),
      encode: SchemaGetter.forbidden(() => "pr-shots only decodes its flags"),
    })
  );
}

/** The run's name: lowercase letters, digits and dashes. */
export const RunName = fromText(Schema.String, (input) =>
  /^[a-z0-9][a-z0-9-]*$/.test(input)
    ? Result.succeed(input)
    : Result.fail("lowercase letters, digits and dashes, such as phone-dial")
);

/** A placeholder origin, to check that a route resolves on whatever source it is opened on. */
const ROUTE_BASE = new URL("http://source.invalid");

/**
 * A docs path, starting with a single `/`. A second slash or a backslash would make URL
 * resolution treat the rest as a host and leave the source, and URL parsing drops tabs and line
 * breaks, which can turn a path into a host too. So the route has no control character and must
 * resolve to a URL on the base's own origin.
 */
export const Route = fromText(Schema.String, (input) =>
  input.startsWith("/") &&
  !input.startsWith("//") &&
  !input.includes("\\") &&
  !hasControlCharacter(input) &&
  URL.parse(input, ROUTE_BASE)?.origin === ROUTE_BASE.origin
    ? Result.succeed(input)
    : Result.fail('a docs path starting with a single "/", such as /components/button')
);

/** `<role>:<accessible name>`. Only the first colon separates them, so a name may hold colons. */
export const TargetFromText = fromText(Target, (input) =>
  parseRoleAndName(input, { role: "textbox", name: "Mobile" }, "")
);

/**
 * `<role>:<accessible name>[@<n>]`, parsed like `--target`. A trailing `@` and digits pick the
 * match, counting from 0; any other `@` belongs to the name. A name that itself ends in `@` and
 * digits keeps them when `@0` follows.
 */
export const ClickStepFromText = fromText(ClickStep, (input) => {
  const match = /^(.*)@(\d+)$/su.exec(input);
  const text = match?.[1] ?? input;
  const nth = match?.[2] === undefined ? 0 : Number(match[2]);
  return Result.map(
    parseRoleAndName(text, { role: "tab", name: "Internal" }, "[@<n>]"),
    ({ role, name }) => ({
      role,
      name,
      nth,
    })
  );
});

/** A whole number of 0 or more. */
export const Count = fromText(Schema.Number, (input) =>
  /^\d+$/.test(input) ? Result.succeed(Number(input)) : Result.fail("a whole number of 0 or more")
);

/** A device scale factor above 0 and at most 4. */
export const Scale = fromText(Schema.Number, (input) => {
  const scale = Number(input);
  return input.trim() === "" || !Number.isFinite(scale) || scale <= 0 || scale > 4
    ? Result.fail("a number above 0 and at most 4")
    : Result.succeed(scale);
});

/** pixelmatch's matching threshold, from 0 to 1. */
export const Threshold = fromText(Schema.Number, (input) => {
  const threshold = Number(input);
  return input.trim() === "" || !Number.isFinite(threshold) || threshold < 0 || threshold > 1
    ? Result.fail("a number from 0 to 1")
    : Result.succeed(threshold);
});

/** A pull request number. */
export const PullRequest = fromText(Schema.Number, (input) =>
  /^[1-9]\d*$/.test(input) ? Result.succeed(Number(input)) : Result.fail("a pull request number, such as 182")
);

/** A comma list of theme slugs, `<variant>-<brand>-<segment>`. */
export const Themes = fromText(Schema.NonEmptyArray(ThemeChoice), (input) =>
  parseList(input, (slug): Result.Result<ThemeChoice, string> => {
    const [variant, brand, segment, ...rest] = slug.split("-");
    if (
      variant === undefined ||
      brand === undefined ||
      segment === undefined ||
      rest.length > 0 ||
      !isVariant(variant) ||
      !/^[a-z]+$/.test(brand) ||
      !isSegment(segment)
    ) {
      return Result.fail(
        `"${slug}" is not a theme slug; use <internal|external>-<brand>-<private|company>, such as external-tkas-company`
      );
    }
    return Result.succeed({ _tag: "picked", slug, variant, brand, segment });
  })
);

/** A comma list of densities, each an override. */
export const Densities = fromText(Schema.NonEmptyArray(DensityChoice), (input) =>
  parseList(input, (item): Result.Result<DensityChoice, string> =>
    item === "dense" || item === "comfortable"
      ? Result.succeed({ _tag: "override", density: item })
      : Result.fail(`"${item}" must be dense or comfortable`)
  )
);

/** A comma list of browser engines. */
export const Engines = fromText(Schema.NonEmptyArray(Engine), (input) =>
  parseList(input, (item): Result.Result<Engine, string> =>
    item === "chromium" || item === "webkit" || item === "firefox"
      ? Result.succeed(item)
      : Result.fail(`"${item}" must be chromium, webkit or firefox`)
  )
);

/** The largest window side `--viewports` takes, in CSS pixels. */
const MAX_VIEWPORT_SIDE = 4096;

/**
 * A comma list of window sizes, `<width>x<height>` in CSS pixels. Only canonical whole numbers
 * count, so one size has one spelling, and a size given twice is kept once.
 */
export const Viewports = fromText(Schema.NonEmptyArray(Viewport), (input) => {
  const parsed = parseList(input, (item): Result.Result<Viewport, string> => {
    const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(item);
    const width = Number(match?.[1]);
    const height = Number(match?.[2]);
    return match !== null && width <= MAX_VIEWPORT_SIDE && height <= MAX_VIEWPORT_SIDE
      ? Result.succeed({ width, height })
      : Result.fail(
          `"${item}" is not a window size; use <width>x<height> in whole CSS pixels from 1 to ${String(MAX_VIEWPORT_SIDE)}, written without leading zeros, such as 1280x800`
        );
  });
  return Result.map(parsed, ([first, ...rest]): NonEmpty<Viewport> => {
    const same = (a: Viewport, b: Viewport) => a.width === b.width && a.height === b.height;
    return [
      first,
      ...rest.filter(
        (size, index) => !same(size, first) && rest.findIndex((other) => same(other, size)) === index
      ),
    ];
  });
});

/** `prod`, `local` or an http(s) URL, of which only the origin is kept. */
export const SourceFromText = fromText(Source, (input): Result.Result<Source, string> => {
  if (input === "local") {
    return Result.succeed({ _tag: "local" });
  }
  if (input === "prod") {
    return Result.succeed(prodSource());
  }
  const url = URL.parse(input);
  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return Result.fail("prod, local or an http(s) URL");
  }
  return Result.succeed({ _tag: "remote", origin: new URL(url.origin), label: url.origin });
});

/**
 * The prod source, the default for `--before`.
 *
 * @returns A remote source labelled `prod`.
 */
export function prodSource(): Source {
  return { _tag: "remote", origin: new URL(PROD_ORIGIN), label: "prod" };
}

/**
 * The label the docs theme picker shows for a variant.
 *
 * @param variant - The variant.
 * @returns The radio item's accessible name.
 */
export function variantLabel(variant: Variant): string {
  return VARIANT_LABELS[variant];
}

/**
 * The label the docs theme picker shows for a segment.
 *
 * @param segment - The segment.
 * @returns The radio item's accessible name.
 */
export function segmentLabel(segment: Segment): string {
  return SEGMENT_LABELS[segment];
}

/**
 * Whether the text holds an ASCII control character: U+0000 to U+001F, or U+007F. Each is one
 * UTF-16 code unit, so the check reads code units.
 */
function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Splits `<role>:<accessible name>` at its first colon. `example` is a valid value the messages
 * show, and `suffix` what the flag's syntax adds after the name.
 */
function parseRoleAndName(input: string, example: Target, suffix: string): Result.Result<Target, string> {
  const separator = input.indexOf(":");
  const role = separator === -1 ? input : input.slice(0, separator);
  const name = separator === -1 ? "" : input.slice(separator + 1);
  if (!isAriaRole(role)) {
    return Result.fail(
      `"${role}" is not an ARIA role; use <role>:<accessible name>${suffix}, such as ${example.role}:${example.name}`
    );
  }
  if (name === "") {
    return Result.fail(`an accessible name after the role, such as ${role}:${example.name}`);
  }
  return Result.succeed({ role, name });
}

function isAriaRole(role: string): role is AriaRole {
  return ARIA_ROLES.some((known) => known === role);
}

function isVariant(value: string): value is Variant {
  return Object.hasOwn(VARIANT_LABELS, value);
}

function isSegment(value: string): value is Segment {
  return Object.hasOwn(SEGMENT_LABELS, value);
}

/**
 * Split a comma list, dropping blanks and repeats so `a,,a` captures `a` once, and parse each
 * entry. The first entry that fails names the problem.
 */
function parseList<T>(
  input: string,
  parseItem: (item: string) => Result.Result<T, string>
): Result.Result<NonEmpty<T>, string> {
  const items = [
    ...new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "")
    ),
  ];
  const parsed: T[] = [];
  for (const item of items) {
    const result = parseItem(item);
    if (Result.isFailure(result)) {
      return Result.fail(result.failure);
    }
    parsed.push(result.success);
  }
  const [first, ...rest] = parsed;
  return first === undefined ? Result.fail("at least one entry") : Result.succeed([first, ...rest]);
}
