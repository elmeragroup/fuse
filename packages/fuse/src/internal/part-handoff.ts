import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import type { HTMLProps } from "@base-ui/react/types";
import type { ClassValue } from "clsx";

import { mergeClassName } from "../styles/merge-class-name";

/**
 * Keys a library default may never set. Root and Field own the control's identity and
 * labelling, so a library value there would beat Field's wiring. A name is never a default.
 * `className` and `render` have their own spec fields.
 */
type ReservedKey =
  // A library ref goes after the spread, since Base UI doesn't merge refs.
  | "ref"
  | "id"
  | "htmlFor"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-controls"
  | "aria-label"
  | "className"
  | "render";

/**
 * An open React props record. Base UI's `mergeProps` merges it key by key, and the JSX spread
 * onto the part type-checks each value, so no narrower value type exists at this seam.
 */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- React props are an open record; the spread onto the part type-checks each value
type PropsRecord = Readonly<Record<string, unknown>>;

/** Data attributes a library default may set whatever the part's props declare. */
type DataAttributes = { readonly [K: `data-${string}`]: string | number | boolean | undefined };

/**
 * Library defaults for a part, typed from the props being handed off, so the part checks
 * each value and a misspelled key is an excess property. A key the component destructured
 * is not in `P`; `handoff`'s channel rule says where it goes. A reserved key is typed
 * `never`, so a defaults object built in a variable or a spread can't carry one either;
 * leaving it out would only catch it as an excess property of a fresh literal.
 */
type Defaults<P> = DataAttributes & { readonly [K in Exclude<keyof P, ReservedKey>]?: P[K] } & {
  readonly [K in ReservedKey]?: never;
};

/** A Base UI `className`: a string or a callback over the part's state. */
type ClassNameProp = string | ((state: never) => string | undefined);

/** Consumer props as the module reads them: className and render apart from the rest. */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- the consumer's part props, read only to split out className and render
type PartProps = { readonly className?: ClassNameProp; readonly render?: unknown } & PropsRecord;

/** The props Base UI hands a render callback: the part's final merged props, ref included. */
type PartRenderProps = HTMLProps;

/** A library render target, called by the part with its final props and state. */
type RenderTarget<S> = (props: PartRenderProps, state: S) => ReactElement;

/** How the module rendering a Base UI part hands consumer props to it. */
type HandoffSpec<P, S> = {
  /** Library DOM and data defaults for the part. Every defined consumer prop beats them. */
  readonly defaults?: Defaults<P>;
  /** Library classes. The consumer's className, string or state callback, merges after them. */
  readonly classes?: readonly ClassValue[];
  /**
   * Library render target. It receives the final props, so library props never sit on a
   * render element where they would beat the consumer's. Write presentational props
   * (`variant`, `size`) before spreading the props it receives. A consumer `render` replaces it.
   */
  readonly as?: RenderTarget<S>;
};

type ValueOf<P, K extends PropertyKey> = K extends keyof P ? Exclude<P[K], undefined> : never;

/** The keys handoff resolves itself rather than copying. */
type ResolvedKey = "className" | "render";

/**
 * The consumer's props with `className` merged and `render` resolved. Spread it onto the
 * part in the same render. `Omit` keeps each key's modifiers, so a required part prop
 * such as `Tabs.Tab`'s `value` stays required.
 */
type HandedOff<P, S = unknown> = P extends unknown
  ? Omit<P, ResolvedKey> & {
      className?: [ValueOf<P, "className">] extends [never] ? string : ValueOf<P, "className">;
      render?: ValueOf<P, "render"> | RenderTarget<S>;
    }
  : never;

function defined(props: PropsRecord): PropsRecord {
  return Object.fromEntries(Object.entries(props).filter((entry) => entry[1] !== undefined));
}

/**
 * Hand consumer props to a Base UI part. Call it once, in the module that renders the part,
 * and spread the result onto the part before your own `ref`:
 *
 * ```tsx
 * <Primitive.Part {...handoff(props, { defaults, classes, as })} ref={ref} />
 * ```
 *
 * A Base UI part stacks its own Root/Field props below the props it is given, and its merge
 * copies `undefined`. So no `undefined` key reaches the part, from the consumer or from
 * `defaults`, and a forwarded `aria-labelledby={undefined}` can no longer erase Field's
 * label. Precedence on the part is `defaults` < defined consumer props, and both sit above
 * Root/Field state. Handlers merge through Base UI `mergeProps`: the consumer's runs first
 * and can call `event.preventBaseUIHandler()` to skip the library's. `style` objects
 * merge. `ref` passes through untouched. The call is pure and idempotent, so a Fuse
 * wrapper around a Fuse part spreads its props raw and leaves the filter to the part.
 *
 * Each value has one channel, picked by what it is:
 * - `defaults` holds library values a consumer may override.
 * - The consumer argument holds consumer props, plus any value resolved from them that can
 *   be `undefined` (a merged `aria-describedby`, `id ?? generatedId`, an optional destructured
 *   prop such as `toastManager`), so an absent one stays absent.
 * - A destructured value that is always defined (a destructuring default, a total lookup, a
 *   non-optional prop) goes on the part as an attribute after the spread, where the part
 *   type-checks it and rejects a misspelled key.
 *
 * @template P - The consumer props for the part, after the caller took out its own props.
 * @template S - The part state the library render target reads.
 * @param props - Consumer props. Keep `className`, `render` and `aria-*` in them.
 * @param spec - Library defaults, classes and render target for the part.
 * @returns Props to spread onto the part.
 */
export function handoff<P extends object, S = unknown>(
  props: P,
  spec: HandoffSpec<NoInfer<P>, S> = {}
): HandedOff<P, NoInfer<S>> {
  // SAFETY: `handoff` is spread onto a Base UI part, whose props type its className as a
  // string or a state callback; the spread itself type-checks the consumer's value there.
  const { className, render, ...consumer } = props as PartProps;
  const classes = spec.classes ?? [];
  const merged = mergeProps<"div">(defined(spec.defaults ?? {}), defined(consumer));
  const classed =
    className === undefined && classes.length === 0
      ? merged
      : { ...merged, className: mergeClassName(className, ...classes) };
  const target = spec.as;
  const handed =
    render !== undefined
      ? { ...classed, render }
      : target === undefined
        ? classed
        : {
            ...classed,
            // Base UI warns when a render callback is named like a component; this name is lowercase.
            render: function renderPartTarget(partProps: PartRenderProps, state: S): ReactElement {
              return target(partProps, state);
            },
          };
  // SAFETY: `handed` holds exactly the defined consumer keys over the defaults, with
  // className merged and render resolved; Object.entries loses that key/value correlation.
  return handed as HandedOff<P, NoInfer<S>>;
}
