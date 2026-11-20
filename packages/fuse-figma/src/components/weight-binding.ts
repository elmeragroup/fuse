/**
 * A text layer whose `font-weight` reads a synced variable, as Selection item's title reads
 * `--selection-title-weight`, 400 in neutral themes and 500 in branded ones. Figma binds a text's
 * `fontWeight` to a FLOAT variable and gives the text, in each mode, the face its family names for
 * the weight there (the typings' `VariableBindableTextField`, Figma's guide to typography variables),
 * so the layer binds the variable, and its `fontStyle` is the face of the lightest weight the
 * variable takes. The plugin needs every face the layer can show loaded before it writes the layer,
 * so the binding lists each face between the variable's least and greatest weight that the kit
 * names. A variable whose weights the synced set does not bound, or bounds below or above every
 * weight the kit names a face for, binds nothing, and the label stays unmapped.
 */
import type { VariableIndex } from "./css-values";
import { FONT_WEIGHT_STYLES } from "./kit-spec";
import type { TextWeightSpec, VariableRef } from "./kit-spec";

/**
 * The binding a label's variable weight takes, with the faces it can show.
 *
 * @param variable - The FLOAT variable the weight reads.
 * @param variables - The synced variables, which bound the weight across every mode.
 * @returns The binding, or undefined where the variable's weights name no face the kit knows.
 */
export function weightBinding(variable: VariableRef, variables: VariableIndex): TextWeightSpec | undefined {
  const least = variables.minimum(variable);
  const greatest = variables.maximum(variable);
  if (
    least === undefined ||
    greatest === undefined ||
    !FONT_WEIGHT_STYLES.has(least) ||
    !FONT_WEIGHT_STYLES.has(greatest)
  ) {
    return undefined;
  }
  const faces = [...FONT_WEIGHT_STYLES].flatMap(([weight, face]) =>
    weight >= least && weight <= greatest ? [face] : []
  );
  return { variable, faces };
}
