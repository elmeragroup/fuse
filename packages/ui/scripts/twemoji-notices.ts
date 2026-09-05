import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const TWEMOJI_NOTICE_FILE = "THIRD_PARTY_NOTICES.md";
export const TWEMOJI_LICENSE_FILE = "licenses/twemoji-CC-BY-4.0.txt";

const NOTICE_SNIPPETS = [
  "Twemoji — Copyright 2019 Twitter, Inc and other contributors",
  "U+1F641",
  "U+1F642",
  "U+1F610",
  "U+1F62D",
  "U+1F973",
  "https://github.com/jdecked/twemoji",
  "https://creativecommons.org/licenses/by/4.0/",
  "inlined as React components",
  "accessibility/data-slot wrapper",
  "SVG path data unchanged",
] as const;

const LICENSE_SNIPPETS = [
  "Attribution 4.0 International",
  "Creative Commons Attribution 4.0 International Public License",
] as const;

/**
 * Package-file and packed-artifact gate for the Twemoji CC BY 4.0 notices (emoji.md §5).
 * Returns a failure when either file is absent or missing required attribution.
 */
export function twemojiNoticeFailure(root: string): string | undefined {
  const noticePath = join(root, TWEMOJI_NOTICE_FILE);
  const licensePath = join(root, TWEMOJI_LICENSE_FILE);
  if (!existsSync(noticePath)) {
    return `missing ${TWEMOJI_NOTICE_FILE}`;
  }
  if (!existsSync(licensePath)) {
    return `missing ${TWEMOJI_LICENSE_FILE}`;
  }
  const notice = readFileSync(noticePath, "utf8");
  for (const snippet of NOTICE_SNIPPETS) {
    if (!notice.includes(snippet)) {
      return `${TWEMOJI_NOTICE_FILE} is missing required attribution: ${snippet}`;
    }
  }
  const license = readFileSync(licensePath, "utf8");
  for (const snippet of LICENSE_SNIPPETS) {
    if (!license.includes(snippet)) {
      return `${TWEMOJI_LICENSE_FILE} is not the complete LICENSE-GRAPHICS text`;
    }
  }
  return undefined;
}

export function copyTwemojiNotices(packageRoot: string, distRoot: string): void {
  const failure = twemojiNoticeFailure(packageRoot);
  if (failure !== undefined) {
    throw new Error(`packages/ui Twemoji notices: ${failure}`);
  }
  copyFileSync(join(packageRoot, TWEMOJI_NOTICE_FILE), join(distRoot, TWEMOJI_NOTICE_FILE));
  const destLicense = join(distRoot, TWEMOJI_LICENSE_FILE);
  mkdirSync(dirname(destLicense), { recursive: true });
  copyFileSync(join(packageRoot, TWEMOJI_LICENSE_FILE), destLicense);
}
