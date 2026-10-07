/**
 * Places a run's table in a pull request body between named markers, so running the same shots
 * again replaces the block instead of adding a second one.
 */

/**
 * Put a run's table into a PR body.
 *
 * The block replaces an existing `<!-- pr-shots:<name> -->` block wherever it is; each marker
 * counts only on a line of its own. Without one, the block goes at the end of the
 * `## Verification` section, and without that section a new one is appended to the body.
 *
 * @param body - The current PR body.
 * @param name - The run's name, which keys the markers.
 * @param table - The table Markdown.
 * @returns The new body.
 */
export function placeShots(body: string, name: string, table: string): string {
  const open = `<!-- pr-shots:${name} -->`;
  const close = `<!-- /pr-shots:${name} -->`;
  const block = `${open}\n\n${table.trim()}\n\n${close}`;
  const normalized = body.replaceAll("\r\n", "\n");

  // A marker counts only as a whole line: the table's alt text repeats `--fill`, which may
  // itself hold a marker.
  const start = lineIndex(normalized, open, 0);
  const end = start === -1 ? -1 : lineIndex(normalized, close, start + open.length);
  if (start !== -1 && end !== -1) {
    return `${normalized.slice(0, start)}${block}${normalized.slice(end + close.length)}`;
  }

  const heading = /^##[ \t]+Verification[ \t]*$/m.exec(normalized);
  if (heading === null) {
    return `${normalized.trimEnd()}\n\n## Verification\n\n${block}\n`;
  }
  const sectionStart = heading.index + heading[0].length;
  const nextHeading = /^#{1,2}[ \t]/m.exec(normalized.slice(sectionStart));
  const sectionEnd = nextHeading === null ? normalized.length : sectionStart + nextHeading.index;
  const section = normalized.slice(sectionStart, sectionEnd).trimEnd();
  const rest = normalized.slice(sectionEnd);
  return `${normalized.slice(0, sectionStart)}${section}\n\n${block}\n${rest === "" ? "" : `\n${rest}`}`;
}

/** Where `line` stands alone on a line at or after `from`, or -1. */
function lineIndex(text: string, line: string, from: number): number {
  for (let index = text.indexOf(line, from); index !== -1; index = text.indexOf(line, index + 1)) {
    const startsLine = index === 0 || text[index - 1] === "\n";
    const after = index + line.length;
    const endsLine = after === text.length || text[after] === "\n";
    if (startsLine && endsLine) {
      return index;
    }
  }
  return -1;
}
