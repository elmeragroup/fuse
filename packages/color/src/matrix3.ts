/**
 * 3×3 matrix arithmetic and the matrices the color conversions share. `oklch.ts` converts OKLab
 * to sRGB through Björn Ottosson's published matrices, `oklab.ts` converts back through their
 * exact inverses, so a round trip returns its input to rounding error, and `cvd.ts` applies the
 * Machado matrices with the same product.
 */

/** A 3×3 matrix, row by row. */
export type Matrix3 = readonly [Vector3, Vector3, Vector3];

/** A vector of three components, such as one color's channels. */
export type Vector3 = readonly [number, number, number];

/**
 * Multiply a matrix by a column vector.
 *
 * @param matrix - The matrix.
 * @param vector - The column vector.
 * @returns The product, one component per matrix row.
 */
export function apply(matrix: Matrix3, [x, y, z]: Vector3): Vector3 {
  const row = ([a, b, c]: Vector3): number => a * x + b * y + c * z;
  return [row(matrix[0]), row(matrix[1]), row(matrix[2])];
}

/** The inverse of an invertible matrix, by cofactors over the determinant. */
function invert([[a, b, c], [d, e, f], [g, h, i]]: Matrix3): Matrix3 {
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    [(e * i - f * h) / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant],
    [(f * g - d * i) / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant],
    [(d * h - e * g) / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant],
  ];
}

/** OKLab to the cone responses before the cube, from "A perceptual color space" (2020). */
export const OKLAB_TO_LMS: Matrix3 = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];

/** Cubed cone responses to linear sRGB, from the same source. */
export const LMS_TO_LINEAR_SRGB: Matrix3 = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

/**
 * Linear sRGB to cone responses, the exact inverse of {@link LMS_TO_LINEAR_SRGB}. It matches
 * Ottosson's published forward matrix within 1e-7.
 */
export const LINEAR_SRGB_TO_LMS: Matrix3 = invert(LMS_TO_LINEAR_SRGB);

/**
 * Cube-rooted cone responses to OKLab, the exact inverse of {@link OKLAB_TO_LMS}. It matches
 * Ottosson's published forward matrix within 1e-7.
 */
export const LMS_TO_OKLAB: Matrix3 = invert(OKLAB_TO_LMS);
