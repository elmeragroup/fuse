/**
 * What a box's transforms draw: a `rotate` as Figma's turn, a `transform` that moves nothing at
 * rest, and a `transform-origin` with no transform to move about. `box-mapping.ts` reads these
 * for every box and icon; `placement.ts` reads the translates and scales that place a part, and
 * `translate-fold.ts` folds a translate its rows share.
 */
import { evaluateLength, evaluateNumber, normalizeCss } from "./css-values";
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
    (value) => {
      const normalized = normalizeCss(value);
      const clockwise = normalized === "none" ? 0 : clockwiseDegrees(normalized);
      if (clockwise === undefined) {
        return undefined;
      }
      const turned = ((-clockwise % 360) + 360) % 360;
      return turned > 180 ? turned - 360 : turned;
    },
    (turn) => ({
      outcome: "literal",
      detail: turn === 0 ? "no turn" : `a rotation of ${turn}, counterclockwise as Figma counts it`,
    }),
    style.feed("rotation")
  );
  return rotation === 0 ? undefined : rotation;
}
