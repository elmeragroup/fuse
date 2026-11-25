import * as PhoneEditor from "../src/components/phone-number-field/phone-editor";
import { phoneEditorFixtures } from "./phone-editor-fixtures";

const { shown } = phoneEditorFixtures(PhoneEditor);

/** What {@link outcome} reads from a state. */
export type PhoneEditorOutcome = ReturnType<typeof shown> & {
  /**
   * The output `steeredNotice` gives `onChange`: `null` when the notice reports nothing, and
   * `undefined` when there is no notice.
   */
  readonly steered: string | null | undefined;
  /** The country of the proposal that still waits, or `null`. */
  readonly waiting: string | null;
};

/**
 * What the order contracts compare between two paths to the same props: what the field shows,
 * the output `steeredNotice` gives `onChange` and the proposal that still waits. Contract (xii) in
 * `phone-editor.country-contracts.test.ts` and contract (xiii) in `phone-editor.release.test.ts`
 * read it.
 *
 * @param state - The live editor's state.
 * @returns The display, output, country, steered output and waiting country.
 */
export function outcome(state: PhoneEditor.PhoneEditorState): PhoneEditorOutcome {
  return {
    ...shown(state),
    steered: PhoneEditor.steeredNotice(state)?.output,
    waiting: PhoneEditor.observeCountry(state).proposed?.code ?? null,
  };
}
