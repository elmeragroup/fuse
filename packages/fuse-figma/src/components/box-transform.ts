/**
 * What a box's transforms draw: a `rotate` as Figma's turn, a `transform` that moves nothing at
 * rest, and a `transform-origin` with no transform to move about. `box-mapping.ts` reads these
 * for every box and icon; `placement.ts` reads the translates and scales that place a part, and
 * `translate-fold.ts` folds a translate its rows share.
 */
import { evaluateLength, evaluateNumber, normalizeCss, splitTopLevel } from "./css-values";
import type { RotationSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The properties that transform a box about its `transform-origin`. */
const TRANSFORMS = ["transform", "translate", "rotate", "scale"] as const;

/** What the capture measured of a box's transform. */
type MeasuredTransform = {
  /** The box's `transform` computes to the identity matrix in every mode. */
  readonly identityTransform: boolean;
};

/**
 * Drop a box's `transform-origin` where the box sets no transform at rest, as a popup's origin only
 * places the zoom of its enter animation. The origin moves nothing without a transform (CSS
 * Transforms 1 §6). Beside a transform it stays unread, so it lands unmapped, since the kit turns and
 * scales a layer about its center.
 *
 * @param style - The box's style.
 * @param measured - What the capture measured of the box, undefined for a box no capture measured.
 */
export function dropIdleOrigin(style: LayerStyle, measured: MeasuredTransform | undefined): void {
  const identity = dropIdentityTransform(style, measured);
  if (TRANSFORMS.some((property) => style.has(property) && !(property === "transform" && identity))) {
    return;
  }
  // Base UI writes `--transform-origin` on the positioner, so the value may never resolve here, and
  // the declaration is marked rather than read.
  style.mark(
    "transform-origin",
    "dropped",
    "the box sets no transform at rest, so the origin a transform moves about moves nothing",
    []
  );
}

/** The transform functions that move nothing at their identity value, and that value. */
const IDENTITY_FUNCTIONS: ReadonlyMap<string, number> = new Map([
  ["translate", 0],
  ["translatex", 0],
  ["translatey", 0],
  ["translatez", 0],
  ["translate3d", 0],
  ["scale", 1],
  ["scalex", 1],
  ["scaley", 1],
  ["rotate", 0],
]);

/**
 * Whether a `transform` value moves nothing: `none`, or a list of translations by zero, scales by 1
 * and turns by 0, which compose to the identity matrix (CSS Transforms 1 §8), as a Sheet's
 * `translateX(var(--drawer-swipe-movement-x, 0px))` is at rest, before a swipe writes the variable.
 */
function isIdentityTransform(value: string): boolean {
  const normalized = normalizeCss(value).toLowerCase();
  if (normalized === "none") {
    return true;
  }
  const calls = [...normalized.matchAll(/([a-z0-9]+)\(([^()]*)\)/g)];
  const rest = normalized.replaceAll(/([a-z0-9]+)\(([^()]*)\)/g, "").trim();
  return (
    calls.length > 0 &&
    rest === "" &&
    calls.every(([, name = "", args = ""]) => {
      const identity = IDENTITY_FUNCTIONS.get(name);
      return (
        identity !== undefined &&
        args.split(",").every((arg) => {
          const number = /deg|turn|rad$/.test(arg.trim()) ? Number.parseFloat(arg) : evaluateNumber(arg);
          const length = identity === 0 ? (evaluateLength(arg) ?? number) : number;
          return length === identity;
        })
      );
    })
  );
}

/**
 * Drop a box's `transform` where it moves nothing at rest, so Figma's untransformed layer draws it:
 * where its value is one {@link isIdentityTransform} reads as the identity, or where the capture
 * measured it as the identity matrix in every mode. Chromium computes the matrix from any
 * expression, as Toast's root nests its stack index in `calc()` and `max()`, which the value's
 * reading does not evaluate, and which multiplies the root's height by 0 at the front of the stack.
 *
 * @param style - The box's style.
 * @param measured - What the capture measured of the box, undefined for a box no capture measured.
 * @returns Whether the box's transform is the identity, false where it sets none.
 */
function dropIdentityTransform(style: LayerStyle, measured: MeasuredTransform | undefined): boolean {
  const value = style.resolved("transform");
  if (value === undefined) {
    return false;
  }
  const detail = isIdentityTransform(value)
    ? "the transform moves nothing at rest, as an untransformed layer draws"
    : measured?.identityTransform === true
      ? "the capture measured the transform as the identity in every mode, as an untransformed layer draws"
      : undefined;
  if (detail === undefined) {
    return false;
  }
  style.read(
    "transform",
    (read) => read,
    () => ({ outcome: "dropped", detail }),
    []
  );
  return true;
}

/**
 * The degrees of a turn as Tailwind compiles it: `rotate-*` to an angle such as `180deg`, and
 * `-rotate-*` to `calc(90deg * -1)`.
 *
 * @returns The degrees clockwise, or undefined for any other value, such as another unit or an axis.
 */
function clockwiseDegrees(value: string): number | undefined {
  const angle = /^(-?\d*\.?\d+)deg$/.exec(value)?.[1];
  const negated = /^calc\((\d*\.?\d+)deg \* -1\)$/.exec(value)?.[1];
  if (angle !== undefined) {
    return Number(angle);
  }
  return negated === undefined ? undefined : -Number(negated);
}

/**
 * A CSS angle as the turn Figma's `rotation` holds: counterclockwise, from -180 to 180, as
 * {@link readRotation} says. `none` is no turn.
 *
 * @param value - The angle, as `rotate` or `rotate()` takes it.
 * @returns The turn, or undefined for a value {@link clockwiseDegrees} does not read.
 */
function figmaTurn(value: string): RotationSpec | undefined {
  const normalized = normalizeCss(value);
  const clockwise = normalized === "none" ? 0 : clockwiseDegrees(normalized);
  if (clockwise === undefined) {
    return undefined;
  }
  const turned = ((-clockwise % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
}

/**
 * The `transform-box` values whose reference box is an HTML box's border box: unset, `border-box`,
 * and `view-box` and `stroke-box`, which CSS Transforms 1 §7 resolves to the border box for a box with
 * a CSS layout. `content-box` and `fill-box`, which resolves to the content box, take the box inside
 * its border. Chromium agreed on 2026-11-21: an 8px `border-box` square with a 1px border moved 4px
 * under `translateX(-50%)` at the first four and 3px at the other two.
 */
const BORDER_REFERENCES: ReadonlySet<string> = new Set(["", "border-box", "view-box", "stroke-box"]);

/**
 * Whether a box's transforms take its border box as their reference box, so a percentage in a
 * translate takes the box's own size and a turn and a scale act about a point the box's size sets,
 * as the kit's readers assume. Reads nothing.
 *
 * @param style - The box's style.
 * @returns True where `transform-box` is one of {@link BORDER_REFERENCES}.
 */
export function transformsAboutBorderBox(style: LayerStyle): boolean {
  return BORDER_REFERENCES.has(normalizeCss(style.resolved("transform-box") ?? ""));
}

/** Whether one component of a `transform-origin` is the centre on its axis: `center` or `50%`. */
const CENTRED = new Set(["center", "50%"]);

/**
 * Whether a `transform-origin` is the box's centre, the default `50% 50%`: unset, or one or two
 * components that are each `center` or `50%`, the one left out being the centre too (CSS Transforms
 * 1 §6), with any third, the z offset, at zero. Reads nothing.
 *
 * @param style - The box's style.
 * @returns True where the origin is the centre.
 */
export function originIsCentre(style: LayerStyle): boolean {
  if (!style.has("transform-origin")) {
    return true;
  }
  const [x = "", y = "center", z = "0", ...rest] = normalizeCss(style.resolved("transform-origin") ?? "")
    .split(" ")
    .filter((part) => part !== "");
  return CENTRED.has(x) && CENTRED.has(y) && evaluateLength(z) === 0 && rest.length === 0;
}

/**
 * A box's `transform` as the `translate` and the turn it composes, as {@link foldTranslateTurn}
 * reads it: none, folded, or refused for the reason given.
 */
export type TranslateTurn =
  | { readonly kind: "none" }
  | {
      readonly kind: "folded";
      /** The translate, as the `translate` property writes it: the x and the y move. */
      readonly translate: string;
      /** The turn, counterclockwise as Figma counts it. */
      readonly turn: RotationSpec;
    }
  | { readonly kind: "refused"; readonly why: string };

/**
 * Read a box's `transform` of exactly `translate()` then `rotate()` as the `translate` and the turn
 * it composes, as an arrow's `::before` writes `translate(-50%,50%) rotate(45deg)`. CSS applies the
 * individual `translate`, `rotate` and `scale`, then `transform`, each about the `transform-origin`
 * (CSS Transforms 2 §6). About the box's centre, `transform: translate(T) rotate(R)` moves the centre
 * by T and turns the box about it, the matrix `translate: T; rotate: R` makes. So the fold holds only
 * where the box sets no `translate`, `rotate` or `scale` of its own and its origin is the centre. The
 * caller checks the reference box ({@link transformsAboutBorderBox}). Reads nothing.
 *
 * @param style - The box's style.
 * @returns The translate and the turn, none for `transform: none`, or why any other transform does
 *   not fold.
 */
export function foldTranslateTurn(style: LayerStyle): TranslateTurn {
  const value = normalizeCss(style.resolved("transform") ?? "none");
  if (value === "none") {
    return { kind: "none" };
  }
  const match = /^translate\(([^()]*)\) rotate\(([^()]*)\)$/.exec(value);
  const [, moves = "", angle = ""] = match ?? [];
  const [x, y = "0px", ...rest] = splitTopLevel(moves, ",");
  const turn = figmaTurn(angle);
  if (match === null || x === undefined || rest.length > 0 || turn === undefined) {
    return { kind: "refused", why: `\`transform: ${value}\` is no \`translate()\` then \`rotate()\`` };
  }
  const moved = ["translate", "rotate", "scale"].some(
    (property) => !["", "none"].includes(normalizeCss(style.resolved(property) ?? ""))
  );
  if (moved) {
    return {
      kind: "refused",
      why: "a `translate`, `rotate` or `scale` of the box's own applies before its `transform`",
    };
  }
  return originIsCentre(style)
    ? { kind: "folded", translate: `${x} ${y}`, turn }
    : {
        kind: "refused",
        why: `the transform turns the box about \`transform-origin: ${style.resolved("transform-origin") ?? ""}\`, not its centre`,
      };
}

/**
 * A box's own `rotate`: no turn, a turn {@link readRotation} maps, or an angle it does not read, such
 * as `.125turn`, which still turns the box in CSS.
 */
export type OwnTurn =
  | { readonly kind: "none" }
  | { readonly kind: "turned"; readonly turn: RotationSpec }
  | { readonly kind: "unread"; readonly value: string };

/**
 * The turn a box's own `rotate` gives it, as {@link readRotation} reads it. Reads nothing.
 *
 * @param style - The box's style.
 * @returns The turn from -180 to 180, none for no turn or a whole one, or the angle it does not read.
 */
export function ownTurn(style: LayerStyle): OwnTurn {
  const value = style.resolved("rotate") ?? "none";
  const turn = figmaTurn(value);
  if (turn === undefined) {
    return { kind: "unread", value };
  }
  return turn === 0 ? { kind: "none" } : { kind: "turned", turn };
}

/**
 * Read a part's or an icon's `rotate` as the turn Figma's `rotation` holds. CSS turns a box
 * clockwise about its center and leaves its layout as it was. Figma counts degrees
 * counterclockwise: on 2026-10-22 a real file read `relativeTransform` `[[0, -1], [1, 0]]` at -90, a
 * clockwise turn in its y-down space (PQ), so `rotate: 90deg` is -90. Figma lays a turned layer out
 * by its turned box (PR, PQ), so the plugin's kit check takes only the turns that keep the box.
 * `none` is no turn.
 *
 * @param style - The part's or the icon's style.
 * @returns The turn from -180 to 180, or undefined for none, no `rotate`, or one that does not map.
 */
export function readRotation(style: LayerStyle): RotationSpec | undefined {
  const rotation = style.read(
    "rotate",
    figmaTurn,
    (turn) => ({
      outcome: "literal",
      detail: turn === 0 ? "no turn" : `a rotation of ${turn}, counterclockwise as Figma counts it`,
    }),
    style.feed("rotation")
  );
  return rotation === 0 ? undefined : rotation;
}
