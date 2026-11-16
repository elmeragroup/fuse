import type { Rule } from "@oxlint/plugins";

/**
 * Each wording the Fuse JSDoc house style replaces, with what to write instead. The rules are in
 * `.agents/skills/fuse-jsdoc/SKILL.md`. This list is the part of them a pattern can check.
 */
const WORDINGS: readonly (readonly [pattern: RegExp, write: string])[] = [
  [/[—–]/u, "a period or a comma in place of the dash"],
  [/[“”‘’]/u, "straight quotes"],
  [/\bcolour(?:s|ed|ing)?\b/iu, "US spelling: color"],
  [/\bcentre[sd]?\b/iu, "US spelling: center"],
  [/\bbehaviours?\b/iu, "US spelling: behavior"],
  [/\bgrey\b/iu, "US spelling: gray"],
  [/\b(?:cancelled|cancelling|labelled|labelling|modelled|modelling)\b/iu, "US spelling with one l"],
  [/\b(?:honour|favour|neighbour)\w*/iu, "US spelling without the u"],
  [
    /\b(?:recogni|organi|initiali|seriali|normali|customi|optimi|minimi|maximi|prioriti|summari|finali|synchroni|visuali|utili|memoi|stabili|locali|capitali|categori|authori|emphasi|reali)s(?:e|es|ed|ing|ation)\b/iu,
    "US spelling with -ize",
  ],
  [/\banalys(?:e|es|ed|ing)\b/iu, "US spelling: analyze"],
  [/\be\.g\./iu, '"such as"'],
  [/\bi\.e\./iu, '"that is"'],
  [/\bin order to\b/iu, '"to"'],
  [/\b(?:serves|acts) as\b/iu, '"is"'],
  [/\b(?:leverage[sd]?|leveraging|utilize[sd]?|utilizing)\b/iu, '"use"'],
  [/\b(?:facilitate[sd]?|facilitating)\b/iu, '"help" or the concrete verb'],
  [/\badditionally\b/iu, '"also"'],
  [/\b(?:crucial|pivotal|robust|seamless(?:ly)?|delve|showcase[sd]?)\b/iu, "the plain, concrete word"],
];

/** The header a generator writes. A generated file's prose belongs to its generator. */
const GENERATED = "AUTO-GENERATED FILE";

/** Text that names code, a link target or a parameter, which keeps its own spelling. */
const VERBATIM = /`[^`\n]*`|\{@link[^}]*\}|https?:\/\/\S+|@param\s+\S+/gu;

/**
 * Prose in a `/** … *\/` block reads in the Fuse JSDoc house style: US spelling, no dashes or curly
 * quotes, and plain words for the wordings unslop replaces. Code spans, `{@link}` targets, URLs and
 * `@param` names are left out, since they quote names the prose does not own. So is a generated
 * file.
 */
export const jsdocVoice: Rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Hold JSDoc prose to the Fuse house style in .agents/skills/fuse-jsdoc." },
    messages: {
      wording: "JSDoc wording `{{found}}`: write {{write}} (fuse-jsdoc skill).",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        const comments = context.sourceCode.getAllComments();
        if (comments[0]?.value.includes(GENERATED) === true) return;
        for (const comment of comments) {
          if (comment.type !== "Block" || !comment.value.startsWith("*")) continue;
          const prose = comment.value.replace(VERBATIM, " ");
          for (const [pattern, write] of WORDINGS) {
            const match = pattern.exec(prose);
            if (match === null) continue;
            context.report({ node: comment, messageId: "wording", data: { found: match[0], write } });
          }
        }
      },
    };
  },
};
