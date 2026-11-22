/**
 * Where a turned layer's box sits against its transform's origin. CSS turns a box about its centre,
 * while Figma's `x` and `y` are the origin of the layer's transform, which a free layer turns about
 * (rule 26, PQ). Figma's transform at a turn `r` is `[[cos r, sin r, x], [-sin r, cos r, y]]`, so the
 * centre of a `w` × `h` box is the origin moved by `(cos r · w/2 + sin r · h/2, -sin r · w/2 + cos r ·
 * h/2)`. A half turn puts the origin at the box's far corner, as a 16px icon read `x` 50 and `y` 16 at
 * 180 where its box sat at 34 and 0 (PR).
 */

/** A point in a parent's frame, in pixels from its top left corner. */
export type Point = { readonly x: number; readonly y: number };

/** A layer's size. */
type Size = { readonly width: number; readonly height: number };

/** The cosine and sine of a turn in degrees, counterclockwise as Figma counts it. */
function cosineAndSine(degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { cos: Math.cos(radians), sin: Math.sin(radians) };
}

/**
 * Where the transform's origin sits for a layer whose box's centre sits at a point, at a turn.
 *
 * @param centre - The box's centre.
 * @param size - The layer's size.
 * @param rotation - The layer's turn in degrees.
 * @returns The origin, the layer's `x` and `y`.
 */
export function originFor(centre: Point, size: Size, rotation: number): Point {
  const { cos, sin } = cosineAndSine(rotation);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  return {
    x: centre.x - (cos * halfWidth + sin * halfHeight),
    y: centre.y - (-sin * halfWidth + cos * halfHeight),
  };
}

/**
 * Where a layer's box's centre sits, from its origin, turn and size as it stands.
 *
 * @param layer - The layer.
 * @returns The centre.
 */
export function heldCentre(layer: Point & Size & { readonly rotation: number }): Point {
  const { cos, sin } = cosineAndSine(layer.rotation);
  const halfWidth = layer.width / 2;
  const halfHeight = layer.height / 2;
  return {
    x: layer.x + cos * halfWidth + sin * halfHeight,
    y: layer.y - sin * halfWidth + cos * halfHeight,
  };
}
