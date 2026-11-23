import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { compileSlide } from "../src/bundler/mdx.ts";
import { mdxText } from "../src/deck/mdx-text.ts";

/** Text an author might type: words, ASCII punctuation, other scripts, spaces and line breaks. */
const authorText = fc
  .tuple(
    fc.constantFrom("", "import ", "export ", "# ", "- ", "1. ", "> ", "    "),
    fc.string({
      unit: fc.constantFrom(
        ..."abcXYZ019 \n\t".split(""),
        ..."!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".split(""),
        "é",
        "日",
        "😀"
      ),
      maxLength: 40,
    })
  )
  .map(([start, rest]) => `${start}${rest}`)
  .filter((text) => text.trim() !== "");

describe("mdxText", () => {
  it("writes text that MDX compiles and reads back as the same title", async () => {
    // Unit under test: mdxText. Oracle: the MDX compile the deck renders with; a heading made from
    // the escaped text reads back as the text, with its line breaks as spaces.
    await fc.assert(
      fc.asyncProperty(authorText, async (text) => {
        const compiled = await Effect.runPromise(
          Effect.result(compileSlide("title", "/deck/slides/title.mdx", `# ${mdxText(text)}\n`, "production"))
        );
        expect(Result.isSuccess(compiled) && Option.getOrNull(compiled.success.metadata.title)).toBe(
          text.replace(/\r\n|\r|\n/g, " ").trim()
        );
      }),
      { numRuns: 300 }
    );
  });

  it("keeps a line that starts with import or export as text in a paragraph", async () => {
    const compiled = await Effect.runPromise(
      compileSlide(
        "cover",
        "/deck/slides/cover.mdx",
        `# Talk\n\n${mdxText("import the brief {now}")}\n`,
        "production"
      )
    );
    expect(compiled.code).toContain("import the brief {now}");
  });
});
