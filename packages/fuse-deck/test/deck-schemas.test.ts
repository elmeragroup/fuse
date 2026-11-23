import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import { compileSlide } from "../src/bundler/mdx.ts";
import { parseManifest } from "../src/deck/deck-manifest.ts";

const manifest = (fields: { readonly [key: string]: string | readonly string[] }) =>
  JSON.stringify({
    title: "Talk",
    theme: "neutral-elma-private",
    density: "comfortable",
    aspect: "16:9",
    order: ["cover"],
    ...fields,
  });

describe("parseManifest", () => {
  it("decodes a deck.json create writes", () => {
    const parsed = parseManifest(manifest({ order: ["cover", "how-it-works", "q-and-a-2"] }));
    expect(Result.isSuccess(parsed) && parsed.success.order).toEqual(["cover", "how-it-works", "q-and-a-2"]);
  });

  it.each([
    { name: "a slide id twice", fields: { order: ["cover", "cover"] }, mentions: "order" },
    { name: "a slide id that is not path-safe", fields: { order: ["../escape"] }, mentions: "order" },
    { name: "an unknown setting", fields: { transition: "fade" }, mentions: "transition" },
    { name: "an unknown density", fields: { density: "spacious" }, mentions: "density" },
    { name: "an unknown aspect", fields: { aspect: "21:9" }, mentions: "aspect" },
    { name: "an empty title", fields: { title: "" }, mentions: "title" },
  ])("rejects $name, naming where", ({ fields, mentions }) => {
    const parsed = parseManifest(manifest(fields));
    expect(Result.isFailure(parsed) && parsed.failure._tag).toBe("DeckManifestInvalid");
    expect(Result.isFailure(parsed) && parsed.failure.message).toContain(mentions);
  });

  it("rejects text that is not JSON", () => {
    expect(Result.isFailure(parseManifest("{ title: Talk"))).toBe(true);
  });
});

describe("a slide's compile", () => {
  const compile = (text: string) =>
    Effect.runPromise(Effect.result(compileSlide("intro", "/deck/slides/intro.mdx", text, "production")));

  it("reads the layout and notes from the frontmatter, the title from the first heading, and counts the steps", async () => {
    const compiled = await compile(
      "---\nlayout: section\nnotes: Pause here.\n---\n\nIntro text\n\n```md\n# Not a title\n```\n\n## Why Fuse ##\n\n# Later\n\n<Step>One</Step>\n\nText <Step>two</Step>\n"
    );
    expect(Result.isSuccess(compiled) && compiled.success.metadata).toEqual({
      layout: "section",
      notes: Option.some("Pause here."),
      title: Option.some("Why Fuse"),
      steps: 2,
    });
  });

  it("reads frontmatter and headings exactly as MDX renders them", async () => {
    // Oracle: CommonMark and micromark's frontmatter extension. A fence may carry trailing
    // whitespace, and a Setext underline makes a heading.
    const compiled = await compile("---  \nlayout: cover\n---\t\n\nWhy *Fuse* `now`\n=================\n");
    expect(Result.isSuccess(compiled) && compiled.success.metadata).toEqual({
      layout: "cover",
      notes: Option.none(),
      title: Option.some("Why Fuse now"),
      steps: 0,
    });
  });

  it("gives a slide without frontmatter or heading the content layout and no title", async () => {
    const compiled = await compile("Just text.\n");
    expect(Result.isSuccess(compiled) && compiled.success.metadata).toEqual({
      layout: "content",
      notes: Option.none(),
      title: Option.none(),
      steps: 0,
    });
  });

  it.each([
    { name: "an unknown key", text: "---\ntransition: fade\n---\n# A\n", mentions: "transition" },
    { name: "an unknown layout", text: "---\nlayout: hero\n---\n# A\n", mentions: "layout" },
    {
      name: "YAML that does not parse",
      text: "---\nlayout: [cover\n---\n# A\n",
      mentions: "slides/intro.mdx",
    },
  ])("rejects $name", async ({ text, mentions }) => {
    const compiled = await compile(text);
    expect(Result.isFailure(compiled) && compiled.failure._tag).toBe("SlideFrontmatterInvalid");
    expect(Result.isFailure(compiled) && compiled.failure.message).toContain(mentions);
  });

  it.each([
    { name: "a text expression", text: "# A\n\nShown {ready && <Step>later</Step>}\n", line: 3 },
    { name: "a flow expression", text: "# A\n\n{<Step>later</Step>}\n", line: 3 },
    { name: "an attribute", text: "# A\n\n<div title={<Step>later</Step>} />\n", line: 3 },
  ])("rejects a <Step> inside $name, at its line", async ({ text, line }) => {
    // A step the pass cannot number would render with no index and show from the start.
    const compiled = await compile(text);
    const failure = Result.isFailure(compiled) ? compiled.failure : undefined;
    expect(failure?._tag).toBe("SlideCompileFailed");
    expect(failure?._tag === "SlideCompileFailed" && failure.line).toBe(line);
    expect(failure?.message).toContain("<Step> must be JSX in the slide body");
  });

  it.each([
    { name: "a span", text: '<Morph name="logo"><span>Fuse</span></Morph>\n' },
    {
      name: "an image on its own line",
      text: '<Morph name="logo">\n  <img src="logo.svg" alt="Fuse" />\n</Morph>\n',
    },
    { name: "a Markdown image", text: '<Morph name="logo">![Fuse](logo.svg)</Morph>\n' },
    { name: "a computed child or name", text: "<Morph name={brand}>{logo}</Morph>\n" },
    { name: "a span and a comment", text: '<Morph name="logo"><span />{/* logo */}</Morph>\n' },
    {
      name: "a span and a comment on their own lines",
      text: '<Morph name="logo">\n  <span />\n\n  {/* logo */}\n</Morph>\n',
    },
    {
      name: "two names on one slide",
      text: '<Morph name="a"><b>A</b></Morph> <Morph name="b"><b>B</b></Morph>\n',
    },
  ])("accepts a <Morph> around $name", async ({ text }) => {
    expect(Result.isSuccess(await compile(text))).toBe(true);
  });

  it.each([
    { name: "no name", text: "<Morph><span>Fuse</span></Morph>\n", says: "needs a name" },
    {
      name: "a name that is no identifier",
      text: '<Morph name="Logo"><span>Fuse</span></Morph>\n',
      says: "lowercase",
    },
    {
      name: "a name used twice on the slide",
      text: '<Morph name="logo"><b>A</b></Morph>\n\n<Morph name="logo"><b>B</b></Morph>\n',
      says: "appears twice",
    },
    { name: "a Fragment", text: '<Morph name="logo"><><b>A</b></></Morph>\n', says: "one HTML element" },
    { name: "two elements", text: '<Morph name="logo"><b>A</b><b>B</b></Morph>\n', says: "one HTML element" },
    { name: "a component", text: '<Morph name="logo"><Logo /></Morph>\n', says: "one HTML element" },
    { name: "bare text", text: '<Morph name="logo">Fuse</Morph>\n', says: "one HTML element" },
    {
      name: "only a link definition",
      text: '<Morph name="logo">\n  [logo]: https://example.com/logo.svg\n</Morph>\n',
      says: "one HTML element",
    },
  ])("rejects a <Morph> with $name", async ({ text, says }) => {
    // Oracle: the Morph contract in describe: one HTML element, a CSS-identifier name, once per slide.
    const compiled = await compile(text);
    const failure = Result.isFailure(compiled) ? compiled.failure : undefined;
    expect(failure?._tag).toBe("SlideCompileFailed");
    expect(failure?.message).toContain(says);
  });
});
