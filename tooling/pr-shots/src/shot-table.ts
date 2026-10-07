/**
 * The Markdown a run writes to `table.md` and the `gh pr edit` call that uploads its images.
 */

import type { ShotOptions } from "./options.ts";
import type { Size } from "./pixel-diff.ts";
import { densityName, themeName, viewportName } from "./shot-plan.ts";
import type { Coordinate, Shot, ShotRow } from "./shot-plan.ts";

/** Whether the run has "before" shots. */
export type BeforeOutcome =
  | {
      /** The before source served the route and every before shot was taken. */
      readonly _tag: "captured";
    }
  | {
      /** The before source answered 404, so the component is not deployed there yet. */
      readonly _tag: "not-deployed";
    };

/** What the Diff column says about one row. */
export type DiffCell =
  | {
      /** The pair has one size; `<row>-diff.png` shows where it changed. */
      readonly _tag: "compared";
      /** Pixels that changed. */
      readonly changed: number;
      /** Every pixel in one image. */
      readonly total: number;
    }
  | {
      /** The pair differs in size, so it has no diff image. */
      readonly _tag: "size-changed";
      /** The before image's size. */
      readonly before: Size;
      /** The after image's size. */
      readonly after: Size;
    }
  | {
      /** The row has no before shot to compare with. */
      readonly _tag: "no-before";
    };

/** A planned row with what comparing its pair found. */
export type ComparedRow = {
  /** The planned row. */
  readonly row: ShotRow;
  /** What its Diff cell says. */
  readonly diff: DiffCell;
};

/** The rows the table shows, each carrying its comparison when the table has a Diff column. */
export type TableRows =
  | {
      /** `--no-diff`: the table has no Diff column. */
      readonly _tag: "without-diff";
      /** The planned rows. */
      readonly rows: readonly ShotRow[];
    }
  | {
      /** The table has a Diff column. */
      readonly _tag: "with-diff";
      /** The planned rows with their comparisons. */
      readonly rows: readonly ComparedRow[];
    };

/** The most files one `gh pr edit` attaches (`gh pr edit --help`). */
export const MAX_ATTACHMENTS = 50;

/**
 * Render the before/after table, with a lead line naming the route and both sources.
 *
 * @param options - The parsed run.
 * @param table - The rows, with their comparisons when the table has a Diff column.
 * @param before - Whether the before shots exist.
 * @param beforeLabel - How the before source reads, such as `prod`.
 * @param afterLabel - How the after source reads, such as `local checkout`.
 * @returns Markdown ending in a newline. Images are referenced as `./<file>`.
 */
export function renderTable(
  options: ShotOptions,
  table: TableRows,
  before: BeforeOutcome,
  beforeLabel: string,
  afterLabel: string
): string {
  const lead = `${leadSubject(options, table)}. Before: ${beforeLabel}. After: ${afterLabel}.`;
  const skipped =
    before._tag === "not-deployed"
      ? ` The route answered 404 on ${beforeLabel}, so there are no before shots.`
      : "";
  const shotCells = (row: ShotRow) => [
    rowLabel(options, row),
    before._tag === "captured" ? image(row.before) : `Not deployed on ${beforeLabel}`,
    image(row.after),
  ];
  const body =
    table._tag === "with-diff"
      ? [
          "| Shot | Before | After | Diff |",
          "| --- | --- | --- | --- |",
          ...table.rows.map(({ row, diff }) => tableLine([...shotCells(row), diffText(options, row, diff)])),
        ]
      : [
          "| Shot | Before | After |",
          "| --- | --- | --- |",
          ...table.rows.map((row) => tableLine(shotCells(row))),
        ];
  return `${[`${lead}${skipped}`, "", ...body].join("\n")}\n`;
}

/**
 * The images a run uploads, in table order: each row's before and after shots, then its diff
 * image when the pair was compared.
 *
 * @param table - The rows, with their comparisons when the table has a Diff column.
 * @param before - Whether the before shots exist.
 * @returns The file names to attach.
 */
export function attachedFiles(table: TableRows, before: BeforeOutcome): readonly string[] {
  const shotFiles = (row: ShotRow) => [
    ...(before._tag === "captured" ? [row.before.file] : []),
    row.after.file,
  ];
  return table._tag === "with-diff"
    ? table.rows.flatMap(({ row, diff }) => [
        ...shotFiles(row),
        ...(diff._tag === "compared" ? [row.diffFile] : []),
      ])
    : table.rows.flatMap(shotFiles);
}

/**
 * The most images a run can upload, known from its matrix before any page is opened: a before
 * and an after shot per coordinate, and a diff image per coordinate when diffs are on.
 *
 * @param rows - The planned coordinates, or rows.
 * @param diff - Whether the run diffs each pair.
 * @returns The count `attachedFiles` reaches when every pair is captured and compared.
 */
export function plannedAttachmentCount(rows: readonly Coordinate[], diff: "on" | "off"): number {
  return rows.length * (diff === "on" ? 3 : 2);
}

/**
 * A changed-pixel count and its share of the image, such as `312 px (0.4%)`. A share that
 * rounds to 0.0% but is not zero reads `<0.1%`, so a one-pixel shift never reads as no change.
 *
 * @param changed - Pixels that changed.
 * @param total - Every pixel in the image.
 * @returns The count and the share.
 */
export function formatChange(changed: number, total: number): string {
  const share = (changed / total) * 100;
  const percent = changed === 0 ? "0" : share < 0.1 ? "<0.1" : String(Number(share.toFixed(1)));
  return `${changed.toLocaleString("en-US")} px (${percent}%)`;
}

/**
 * The `gh pr edit` arguments that replace the PR body and upload the images. gh rewrites each
 * `./<file>` reference in the body to the uploaded asset, so the command must run in the
 * directory that holds the images.
 *
 * @param pr - The pull request number, or a placeholder such as `<pr>`.
 * @param bodyFile - The body file, relative to the image directory.
 * @param files - The image file names.
 * @returns The arguments after `gh`.
 */
export function ghEditArgs(pr: string, bodyFile: string, files: readonly string[]): readonly string[] {
  return ["pr", "edit", pr, "--body-file", bodyFile, ...files.flatMap((file) => ["--attach", `./${file}`])];
}

/**
 * Format a command for a POSIX shell, quoting each argument that needs it.
 *
 * @param command - The program.
 * @param args - Its arguments.
 * @returns A line to paste into a shell.
 */
export function shellCommand(command: string, args: readonly string[]): string {
  return [command, ...args].map(shellWord).join(" ");
}

function shellWord(word: string): string {
  if (/^[\w./:@%+=,-]+$/.test(word)) {
    return word;
  }
  return `'${word.replaceAll("'", `'\\''`)}'`;
}

function rowLabel(options: ShotOptions, row: ShotRow): string {
  return [
    themeName(row.theme),
    densityName(row.density, row.after.frame),
    options.colorScheme,
    row.engine,
    viewportName(row.viewport),
  ].join(" · ");
}

/** What the table shows, by frame: the target in its stage or alone, or the page. */
function leadSubject(options: ShotOptions, table: TableRows): string {
  const [first] = table._tag === "with-diff" ? table.rows.map(({ row }) => row) : table.rows;
  const frame = first?.after.frame ?? "viewport";
  const route = `\`${options.route}\``;
  const subject =
    options.target === null ? null : `${options.target.role} "${escapeCell(options.target.name)}"`;
  return {
    stage: `Screenshots of ${subject ?? "the target"} in its demo stage on ${route}`,
    target: `Screenshots of ${subject ?? "the target"} on ${route}`,
    viewport: `Screenshots of the visible part of ${route}`,
    page: `Full-page screenshots of ${route}`,
  }[frame];
}

function diffText(options: ShotOptions, row: ShotRow, cell: DiffCell): string {
  switch (cell._tag) {
    case "compared": {
      const alt = `Pixel diff, ${rowLabel(options, row)}: changed pixels in red over the faded before shot`;
      return `![${escapeCell(alt)}](./${row.diffFile})<br>${formatChange(cell.changed, cell.total)}`;
    }
    case "size-changed":
      return `Size changed from ${sizeText(cell.before)} to ${sizeText(cell.after)}, so no diff`;
    case "no-before":
      return "No before shot";
  }
}

function sizeText({ width, height }: Size): string {
  return `${String(width)} × ${String(height)} px`;
}

function tableLine(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function image(shot: Shot): string {
  return `![${escapeCell(shot.alt)}](./${shot.file})`;
}

/** Keep user text from closing the alt text or splitting the table cell. */
function escapeCell(text: string): string {
  return text.replaceAll(/\s+/g, " ").replaceAll(/[\\[\]|]/g, (character) => `\\${character}`);
}
