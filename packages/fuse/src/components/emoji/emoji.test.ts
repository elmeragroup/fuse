import { createElement } from "react";

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  TWEMOJI_LICENSE_FILE,
  TWEMOJI_NOTICE_FILE,
  twemojiNoticeFailure,
} from "../../../scripts/twemoji-notices";
import {
  Emoji,
  LoudlyCryingFace,
  NeutralFace,
  PartyingFace,
  SlightlyFrowningFace,
  SlightlySmilingFace,
} from "./emoji";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..", "..");

const FACES = [
  ["SlightlyFrowningFace", Emoji.SlightlyFrowningFace],
  ["SlightlySmilingFace", Emoji.SlightlySmilingFace],
  ["NeutralFace", Emoji.NeutralFace],
  ["LoudlyCryingFace", Emoji.LoudlyCryingFace],
  ["PartyingFace", Emoji.PartyingFace],
] as const;

const NAMED = {
  SlightlyFrowningFace,
  SlightlySmilingFace,
  NeutralFace,
  LoudlyCryingFace,
  PartyingFace,
} as const;

describe("named per-face exports", () => {
  it("are reference-equal to the namespace members", () => {
    expect(SlightlyFrowningFace).toBe(Emoji.SlightlyFrowningFace);
    expect(SlightlySmilingFace).toBe(Emoji.SlightlySmilingFace);
    expect(NeutralFace).toBe(Emoji.NeutralFace);
    expect(LoudlyCryingFace).toBe(Emoji.LoudlyCryingFace);
    expect(PartyingFace).toBe(Emoji.PartyingFace);
    expect(NAMED.SlightlySmilingFace).toBe(Emoji.SlightlySmilingFace);
  });
});

describe("emoji markup", () => {
  it.each(FACES)("%s renders an svg with viewBox and data-slot=emoji", (_name, Face) => {
    const html = renderToStaticMarkup(createElement(Face));
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 36 36"');
    expect(html).toContain('data-slot="emoji"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain("role=");
  });

  it("lands className on the svg", () => {
    const html = renderToStaticMarkup(createElement(Emoji.SlightlySmilingFace, { className: "size-5" }));
    expect(html).toContain('class="size-5"');
    expect(html).toContain("<svg");
  });
});

describe("Twemoji package-file notices", () => {
  const scratchDirs: string[] = [];

  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ships both notice files with the required attribution", () => {
    expect(twemojiNoticeFailure(packageRoot)).toBeUndefined();
    expect(readFileSync(join(packageRoot, TWEMOJI_NOTICE_FILE), "utf8")).toContain(
      "Twemoji — Copyright 2019 Twitter, Inc and other contributors"
    );
    expect(readFileSync(join(packageRoot, TWEMOJI_LICENSE_FILE), "utf8")).toContain(
      "Creative Commons Attribution 4.0 International Public License"
    );
  });

  it("fails when either notice file is absent", () => {
    const missingNotice = mkdtempSync(join(tmpdir(), "elmera-twemoji-notice-"));
    const missingLicense = mkdtempSync(join(tmpdir(), "elmera-twemoji-license-"));
    scratchDirs.push(missingNotice, missingLicense);
    mkdirSync(join(missingNotice, "licenses"), { recursive: true });
    writeFileSync(join(missingNotice, TWEMOJI_LICENSE_FILE), "Attribution 4.0 International\n");
    expect(twemojiNoticeFailure(missingNotice)).toBe(`missing ${TWEMOJI_NOTICE_FILE}`);
    writeFileSync(join(missingLicense, TWEMOJI_NOTICE_FILE), "Twemoji\n");
    expect(twemojiNoticeFailure(missingLicense)).toBe(`missing ${TWEMOJI_LICENSE_FILE}`);
  });
});
