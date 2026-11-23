import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import { parseManifest } from "../src/deck/deck-manifest.ts";
import { SlideId } from "../src/deck/slide-id.ts";
import { parseSlideSource } from "../src/deck/slide-source.ts";

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

describe("parseSlideSource", () => {
  const slide = SlideId.make("intro");

  it("reads the layout and notes from the frontmatter and the title from the first heading", () => {
    const parsed = parseSlideSource(
      slide,
      "---\nlayout: section\nnotes: Pause here.\n---\n\nIntro text\n\n```md\n# Not a title\n```\n\n## Why Fuse ##\n\n# Later\n"
    );
    expect(Result.isSuccess(parsed) && parsed.success).toEqual({
      layout: "section",
      notes: Option.some("Pause here."),
      title: Option.some("Why Fuse"),
    });
  });

  it("gives a slide without frontmatter or heading the content layout and no title", () => {
    const parsed = parseSlideSource(slide, "Just text.\n");
    expect(Result.isSuccess(parsed) && parsed.success).toEqual({
      layout: "content",
      notes: Option.none(),
      title: Option.none(),
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
  ])("rejects $name", ({ text, mentions }) => {
    const parsed = parseSlideSource(slide, text);
    expect(Result.isFailure(parsed) && parsed.failure._tag).toBe("SlideFrontmatterInvalid");
    expect(Result.isFailure(parsed) && parsed.failure.message).toContain(mentions);
  });
});
