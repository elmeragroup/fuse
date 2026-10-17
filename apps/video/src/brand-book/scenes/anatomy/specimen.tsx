import { useRef } from "react";
import type { CSSProperties, ReactElement, RefObject } from "react";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";
import { TextField } from "@elmeragroup/fuse/text-field";

import { SelectionSnap } from "../../../components/remocn/selection-snap";
import { useCopy } from "../../../copy/copy";
import { beats } from "../../../music/beat-grid";
import { Rise } from "../../../primitives/rise";
import { STAGE, useStageBox } from "../../../primitives/stage";
import type { StageBox } from "../../../primitives/stage";
import { METER_NUMBER } from "../../../sample/customer-data";

/** A role the specimen resolves. */
export type SpecimenRole = "card" | "foreground" | "input" | "primary" | "success-soft";

/** The parts of the specimen a selection frames, one per role it resolves. */
type SpecimenPart = "card" | "title" | "field" | "action" | "status";

/**
 * The roles in the order they resolve, a beat pair apart, each with the part a selection frames
 * and what stands in for the role until then: the role's custom properties read from a neutral
 * role of the same theme, so the card begins as a grey drawing.
 */
export const RESOLVES = [
  { role: "card", part: "card", beat: 4, stand: { "--card": "var(--background)" } },
  {
    role: "foreground",
    part: "title",
    beat: 6,
    stand: { "--foreground": "var(--muted-foreground)", "--card-foreground": "var(--muted-foreground)" },
  },
  { role: "input", part: "field", beat: 8, stand: { "--input": "var(--border)" } },
  {
    role: "primary",
    part: "action",
    beat: 10,
    stand: { "--primary": "var(--muted)", "--primary-foreground": "var(--muted-foreground)" },
  },
  {
    role: "success-soft",
    part: "status",
    beat: 12,
    stand: {
      "--success-soft": "var(--muted)",
      "--success-soft-foreground": "var(--muted-foreground)",
      "--success": "var(--border)",
    },
  },
] as const satisfies readonly {
  readonly role: SpecimenRole;
  readonly part: SpecimenPart;
  readonly beat: number;
  readonly stand: CSSProperties;
}[];

/** How long a selection holds before it lifts away, so the next one has the stage. */
const SELECTION_HOLD = beats(2);

/** The selection's speed over remocn's timing, so it settles inside its beat pair. */
const SELECTION_SPEED = 1.8;

/** Where the card stands before the stage's scale, in stage pixels: its left edge and its width. */
const CARD = { left: 270, width: 400 } as const;

/** The specimen draws larger than Fuse's own size, around the card's centre, as a specimen plate does. */
const SPECIMEN_SCALE = 1.3;

/** Where the specimen layer scales from, in stage pixels: the card's centre, on the stage's middle row. */
const PIVOT = { x: CARD.left + CARD.width / 2, y: STAGE.height / 2 } as const;

/** Props for {@link SpecimenCard}: the frame, and the parts a selection frames. */
export type SpecimenCardProps = {
  /** The scene's frame, which decides the roles resolved so far. */
  readonly frame: number;
  readonly cardRef: RefObject<HTMLDivElement | null>;
  readonly titleRef: RefObject<HTMLDivElement | null>;
  readonly statusRef: RefObject<HTMLDivElement | null>;
  readonly fieldRef: RefObject<HTMLDivElement | null>;
  readonly actionRef: RefObject<HTMLDivElement | null>;
};

/**
 * The anatomy's specimen card: a title with a status badge, a field, a switch and two actions.
 * Every colour it shows comes from a role, and each role reads its stand-in until its beat, so
 * the card starts as a grey drawing and takes the theme one role at a time.
 *
 * @returns The card.
 */
export function SpecimenCard({
  frame,
  cardRef,
  titleRef,
  statusRef,
  fieldRef,
  actionRef,
}: SpecimenCardProps): ReactElement {
  const { card } = useCopy().brandBook.anatomy;
  const unresolved = RESOLVES.filter(({ beat }) => frame < beats(beat)).reduce<CSSProperties>(
    (stands, { stand }) => ({ ...stands, ...stand }),
    {}
  );
  return (
    <div ref={cardRef} style={{ ...unresolved, width: CARD.width }}>
      <Card.Root>
        <Card.Header className="flex flex-row items-center justify-between gap-3">
          <div ref={titleRef}>
            <Card.Title>{card.title}</Card.Title>
          </div>
          <div ref={statusRef}>
            <Badge variant="soft-success">{card.status}</Badge>
          </div>
        </Card.Header>
        <Card.Content className="flex flex-col gap-5">
          <div ref={fieldRef}>
            <TextField label={card.meter} defaultValue={METER_NUMBER} />
          </div>
          <Field.Root orientation="horizontal" className="items-center">
            <Field.Content>
              <Field.Label>{card.notify}</Field.Label>
            </Field.Content>
            <Switch checked />
          </Field.Root>
          <div className="flex gap-3">
            <div ref={actionRef}>
              <Button>{card.save}</Button>
            </div>
            <Button variant="outline">{card.cancel}</Button>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  );
}

/**
 * The guides' rows in stage pixels: the card's top and bottom edges as the specimen layer's scale
 * about {@link PIVOT} draws them, rounded to whole pixels so each hairline stays sharp.
 */
function guideRows(card: StageBox): readonly [number, number] {
  const scaled = (y: number) => Math.round(PIVOT.y + (y - PIVOT.y) * SPECIMEN_SCALE);
  return [scaled(card.y), scaled(card.y + card.height)];
}

/** Props for {@link SpecimenStage}. */
export type SpecimenStageProps = {
  /** The scene's frame. */
  readonly frame: number;
  /** How far the guides along the card's edges have drawn, from 0 to 1. */
  readonly guides: number;
};

/**
 * The specimen, the guides along its card's edges and the selections that frame its parts as
 * their roles resolve. It measures its parts, so it renders inside the scene's font gate; the
 * selections share its scaled layer, so the boxes they read line up with the parts at any scale.
 *
 * @returns The specimen layer, filling the stage.
 */
export function SpecimenStage({ frame, guides }: SpecimenStageProps): ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const boxes = {
    card: useStageBox(cardRef),
    title: useStageBox(titleRef),
    status: useStageBox(statusRef),
    field: useStageBox(fieldRef),
    action: useStageBox(actionRef),
  } satisfies Record<SpecimenPart, StageBox | null>;
  return (
    <>
      {boxes.card === null
        ? null
        : guideRows(boxes.card).map((y) => (
            <div
              key={y}
              className="absolute inset-x-12 h-px origin-left bg-border"
              style={{ top: y, scale: `${String(guides)} 1` }}
            />
          ))}
      <div
        className="absolute inset-0"
        style={{
          scale: String(SPECIMEN_SCALE),
          transformOrigin: `${String(PIVOT.x)}px ${String(PIVOT.y)}px`,
        }}>
        <div className="absolute top-0 flex h-full items-center" style={{ left: CARD.left }}>
          <Rise at={beats(2)} distance={16}>
            <SpecimenCard
              frame={frame}
              cardRef={cardRef}
              titleRef={titleRef}
              statusRef={statusRef}
              fieldRef={fieldRef}
              actionRef={actionRef}
            />
          </Rise>
        </div>
        {RESOLVES.map(({ role, part, beat }) => {
          const box = boxes[part];
          return box === null ? null : (
            <SelectionSnap
              key={role}
              box={box}
              at={beats(beat)}
              leaveAt={beats(beat) + SELECTION_HOLD}
              speed={SELECTION_SPEED}>
              {`--${role}`}
            </SelectionSnap>
          );
        })}
      </div>
    </>
  );
}
