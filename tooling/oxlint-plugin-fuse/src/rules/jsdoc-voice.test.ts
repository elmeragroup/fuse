import { ruleTester } from "../rule-tester.ts";
import { jsdocVoice } from "./jsdoc-voice.ts";

ruleTester.run("jsdoc-voice", jsdocVoice, {
  valid: [
    "/** Whether the picker shows as invalid, in the center of the row. */\nexport const a = 1;",
    "/** The fill color. Pass `colour` only to the legacy `centre` prop. */\nexport const b = 1;",
    "/** See {@link https://example.com/colour-and-centre} for the grid. */\nexport const c = 1;",
    "// A line comment keeps its own wording — colour, centre.\nexport const d = 1;",
    "/* A plain block comment is not JSDoc — colour. */\nexport const e = 1;",
    "/**\n * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.\n */\nexport const g = 1;",
    "/**\n * Paints the slots.\n * @param emphasised - The emphasized slots.\n */\nexport function f(emphasised) {}",
    "/** Recognizes a canceled drag, such as one the user releases outside. */\nexport const f = 1;",
  ],
  invalid: [
    { code: "/** The row — and its label. */\nexport const a = 1;", errors: [{ messageId: "wording" }] },
    { code: "/** Values 0–100. */\nexport const b = 1;", errors: [{ messageId: "wording" }] },
    { code: "/** The fill colour. */\nexport const c = 1;", errors: [{ messageId: "wording" }] },
    { code: "/** Centred on the row. */\nexport const d = 1;", errors: [{ messageId: "wording" }] },
    {
      code: "/** Recognises a cancelled drag. */\nexport const e = 1;",
      errors: [{ messageId: "wording" }, { messageId: "wording" }],
    },
    { code: "/** A size, e.g. `sm`. */\nexport const f = 1;", errors: [{ messageId: "wording" }] },
    {
      code: "/** Serves as the anchor in order to place the popup. */\nexport const g = 1;",
      errors: [{ messageId: "wording" }, { messageId: "wording" }],
    },
    { code: "/** A “quoted” label. */\nexport const h = 1;", errors: [{ messageId: "wording" }] },
    {
      code: "/** Leverages a robust cache. */\nexport const i = 1;",
      errors: [{ messageId: "wording" }, { messageId: "wording" }],
    },
  ],
});
