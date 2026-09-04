/**
 * The md control inset and type pair: inline padding plus the density-owned font-size
 * and line-height. One constant because five files spelled the same three utilities
 * (the picker recipe, field-box, the RAC input, date-field, NumberField) and they must
 * not drift. Lives outside `utils.ts` so consumers of the focus-ring constants do not
 * inherit these tokens in recipe token extraction.
 */
export const controlInsetMdClass =
  "px-(--control-px-md) [font-size:var(--control-text)] [line-height:var(--control-leading)]";
