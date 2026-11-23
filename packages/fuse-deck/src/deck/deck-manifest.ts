/**
 * `deck.json`: the deck's settings and its slide order. The order is the one list of which slides
 * the deck shows, so every operation on it keeps the ids unique and names only ids it holds.
 */

import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { SlideId } from "./slide-id.ts";

/** Fuse's document densities. */
export const DENSITIES = ["dense", "comfortable"] as const;

/** The slide canvas proportions a deck may use. */
export const ASPECTS = ["16:9", "4:3"] as const;

/** A slide canvas proportion. */
export type Aspect = (typeof ASPECTS)[number];

/** `deck.json` as the deck stores it. */
export const DeckManifest = Schema.Struct({
  /** The deck's title, shown in the browser tab. */
  title: Schema.NonEmptyString,
  /**
   * A Fuse theme slug, `<identity>-<brand>-<segment>`. Only Fuse can tell a legal slug, so the
   * manifest keeps it as a string and the bundler validates it.
   */
  theme: Schema.NonEmptyString,
  /** Fuse's document density. */
  density: Schema.Literals(DENSITIES),
  /** The slide canvas proportion. */
  aspect: Schema.Literals(ASPECTS),
  /** The slide ids in presentation order, each once. */
  order: Schema.UniqueArray(SlideId),
});

/** `deck.json`, decoded. */
export type DeckManifest = typeof DeckManifest.Type;

const decodeManifest = Schema.decodeUnknownResult(Schema.fromJsonString(DeckManifest));

/** `deck.json` is not valid JSON, or its contents do not match the manifest. */
export class DeckManifestInvalid extends Schema.TaggedError<DeckManifestInvalid>()("DeckManifestInvalid", {
  message: Schema.String,
  hint: Schema.String,
}) {}

/**
 * Parse `deck.json`'s text. Unknown keys fail, so a misspelled setting never goes unnoticed.
 *
 * @param text - The file's contents.
 * @returns The manifest, or `DeckManifestInvalid` naming what is wrong.
 */
export function parseManifest(text: string): Result.Result<DeckManifest, DeckManifestInvalid> {
  return Result.mapError(
    decodeManifest(text, { onExcessProperty: "error", errors: "all" }),
    (error) =>
      new DeckManifestInvalid({
        message: `deck.json is invalid: ${error.message}`,
        hint: "Run `fuse-deck describe` for the fields deck.json holds.",
      })
  );
}

/**
 * The manifest as `deck.json` stores it, two-space indented with a trailing newline.
 *
 * @param manifest - The manifest to write.
 * @returns The file's contents.
 */
export function formatManifest(manifest: DeckManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Where a slide goes in the order. */
export type OrderPosition =
  | { readonly _tag: "End" }
  | { readonly _tag: "After"; readonly anchor: SlideId }
  | { readonly _tag: "Before"; readonly anchor: SlideId };

/** The order already holds the id an operation would add. */
export class SlideIdTaken extends Schema.TaggedError<SlideIdTaken>()("SlideIdTaken", {
  message: Schema.String,
  hint: Schema.String,
  id: Schema.String,
}) {}

/** An operation names a slide the order does not hold. */
export class SlideNotInDeck extends Schema.TaggedError<SlideNotInDeck>()("SlideNotInDeck", {
  message: Schema.String,
  hint: Schema.String,
  id: Schema.String,
}) {}

/** A move names the moving slide as its own anchor. */
export class SlideAnchoredToItself extends Schema.TaggedError<SlideAnchoredToItself>()(
  "SlideAnchoredToItself",
  {
    message: Schema.String,
    id: Schema.String,
  }
) {}

const listHint = "Run `fuse-deck slides list` for the ids in the deck.";

function notInDeck(id: SlideId): SlideNotInDeck {
  return new SlideNotInDeck({ message: `The deck has no slide ${id}.`, hint: listHint, id });
}

/**
 * The order with `id` placed at `position`. `order` must not hold `id`.
 */
function place(
  order: readonly SlideId[],
  id: SlideId,
  position: OrderPosition
): Result.Result<readonly SlideId[], SlideNotInDeck> {
  if (position._tag === "End") {
    return Result.succeed([...order, id]);
  }
  const anchor = order.indexOf(position.anchor);
  if (anchor === -1) {
    return Result.fail(notInDeck(position.anchor));
  }
  const at = position._tag === "After" ? anchor + 1 : anchor;
  return Result.succeed([...order.slice(0, at), id, ...order.slice(at)]);
}

/**
 * Add a slide to the order.
 *
 * @param manifest - The deck's manifest.
 * @param id - The new slide.
 * @param position - Where it goes.
 * @returns The manifest with the slide in place, `SlideIdTaken` when the order already holds the
 *   id, or `SlideNotInDeck` when the anchor is not in the order.
 */
export function addSlide(
  manifest: DeckManifest,
  id: SlideId,
  position: OrderPosition
): Result.Result<DeckManifest, SlideIdTaken | SlideNotInDeck> {
  if (manifest.order.includes(id)) {
    return Result.fail(
      new SlideIdTaken({
        message: `The deck already has a slide ${id}.`,
        hint: "Pick another id, or edit the existing slide's file.",
        id,
      })
    );
  }
  return Result.map(place(manifest.order, id, position), (order) => ({ ...manifest, order }));
}

/**
 * Move a slide to another place in the order.
 *
 * @param manifest - The deck's manifest.
 * @param id - The slide to move.
 * @param position - Where it goes, relative to another slide.
 * @returns The manifest with the slide moved, `SlideNotInDeck` when either slide is not in the
 *   order, or `SlideAnchoredToItself` when the anchor is the moving slide.
 */
export function moveSlide(
  manifest: DeckManifest,
  id: SlideId,
  position: Exclude<OrderPosition, { readonly _tag: "End" }>
): Result.Result<DeckManifest, SlideNotInDeck | SlideAnchoredToItself> {
  if (!manifest.order.includes(id)) {
    return Result.fail(notInDeck(id));
  }
  if (position.anchor === id) {
    return Result.fail(
      new SlideAnchoredToItself({ message: `A slide cannot move ${position._tag.toLowerCase()} itself.`, id })
    );
  }
  const without = manifest.order.filter((each) => each !== id);
  return Result.map(place(without, id, position), (order) => ({ ...manifest, order }));
}

/**
 * Take a slide out of the order.
 *
 * @param manifest - The deck's manifest.
 * @param id - The slide to take out.
 * @returns The manifest without the slide, or `SlideNotInDeck` when the order does not hold it.
 */
export function removeSlide(
  manifest: DeckManifest,
  id: SlideId
): Result.Result<DeckManifest, SlideNotInDeck> {
  if (!manifest.order.includes(id)) {
    return Result.fail(notInDeck(id));
  }
  return Result.succeed({ ...manifest, order: manifest.order.filter((each) => each !== id) });
}
