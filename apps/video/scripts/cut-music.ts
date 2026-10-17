import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Cause, Console, Data, Effect, Runtime, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MUSIC_EDIT as BRAND_BOOK_EDIT } from "../src/brand-book/grid.ts";
import { MUSIC_EDIT as CLAUDE_BUILDS_EDIT } from "../src/claude-builds/grid.ts";
import { MUSIC_EDIT as FUSE_RELEASE_EDIT } from "../src/fuse-release/grid.ts";
import type { MusicEdit } from "../src/music/music-edit.ts";
import { editSpan, itemAt, mixEdit } from "./music-mix.ts";
import type { Stereo } from "./music-mix.ts";

/**
 * Renders every film's music edit into one WAV each, with every splice and fade in the samples.
 * A film plays its cut at constant gain, because Remotion applies a volume callback once per
 * video frame and a fade drawn that way steps and clicks. Each edit's times come from its film's
 * `MUSIC_EDIT`, on the same grid its scenes are timed on.
 *
 * Usage, from `apps/video`, after downloading the track (see `AGENTS.md`):
 *   pnpm music:cut
 */

/** Every film's edit; one decode of the track feeds them all. */
const EDITS: readonly MusicEdit[] = [FUSE_RELEASE_EDIT, CLAUDE_BUILDS_EDIT, BRAND_BOOK_EDIT];

/** The downloaded track, under `public/`. */
const SOURCE = "public/music/local/oceanking-edge-of-the-world-219742.mp3";

/** The cut's sample rate: Remotion mixes at 48 kHz, so the cut needs no second resample. */
const SAMPLE_RATE = 48_000;

const CHANNELS = 2;

/** The source decodes to 24-bit PCM, so the edit's maths starts from more than the cut keeps. */
const SOURCE_BYTES = 3;

/**
 * The MP3 decodes up to 4 dB over full scale, and the bundled FFmpeg has no float PCM encoder, so
 * the decode is scaled down by this much to keep its overs, and scaled back up here.
 */
const DECODE_HEADROOM = 0.5;

/** The cut's loudest sample: the edit is scaled to this level, so nothing clips. */
const PEAK_DBFS = -1;

/** The downloaded track is not where the setup puts it. */
class MissingSource extends Data.TaggedError("MissingSource")<{ readonly path: string }> {}

/** `remotion` could not be started, so there is no FFmpeg to decode with. */
class DecoderUnavailable extends Data.TaggedError("DecoderUnavailable")<{ readonly cause: unknown }> {}

/** FFmpeg ran and failed, which a corrupt or partial download causes. */
class DecodeFailed extends Data.TaggedError("DecodeFailed")<{
  /** FFmpeg's exit status, or `undefined` when a signal ended it, which `cause` names. */
  readonly status: number | undefined;
  readonly stderr: string;
  readonly cause?: unknown;
}> {}

/** FFmpeg reported success but its WAV could not be read or has no audio. */
class UnreadableDecode extends Data.TaggedError("UnreadableDecode")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/** The decoded track ends before the last sample the edit reads, as a partial download does. */
class InsufficientSource extends Data.TaggedError("InsufficientSource")<{
  /** Seconds of track the edit reads. */
  readonly needed: number;
  /** Seconds of track the file decodes to. */
  readonly got: number;
}> {}

/** A temporary file or the cut could not be written. */
class WriteFailed extends Data.TaggedError("WriteFailed")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

/** A temporary file or folder the script made could not be removed, so it is left behind. */
class CleanupFailed extends Data.TaggedError("CleanupFailed")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

/** Every way the cut can fail. */
type CutFailure =
  | MissingSource
  | DecoderUnavailable
  | DecodeFailed
  | UnreadableDecode
  | InsufficientSource
  | WriteFailed
  | CleanupFailed;

/** The byte offset and length of a RIFF chunk. */
type Chunk = { readonly start: number; readonly length: number };

/** Finds a chunk in a WAV file, the decoder's `data` chunk included. */
function findChunk(wav: Buffer, id: string): Chunk | undefined {
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const length = wav.readUInt32LE(offset + 4);
    if (wav.toString("ascii", offset, offset + 4) === id) {
      return { start: offset + 8, length: Math.min(length, wav.length - offset - 8) };
    }
    offset += 8 + length + (length % 2);
  }
  return undefined;
}

/** Reads FFmpeg's 24-bit stereo WAV into floats, undoing the decode's headroom. */
function parseDecodedWav(wav: Buffer): Effect.Effect<Stereo, UnreadableDecode> {
  const data = findChunk(wav, "data");
  if (data === undefined) {
    return Effect.fail(new UnreadableDecode({ reason: "the decoded WAV has no data chunk" }));
  }
  const frames = Math.floor(data.length / (CHANNELS * SOURCE_BYTES));
  const stereo: Stereo = [new Float32Array(frames), new Float32Array(frames)];
  for (let frame = 0; frame < frames; frame++) {
    for (const [channel, samples] of stereo.entries()) {
      const sample = wav.readIntLE(data.start + (frame * CHANNELS + channel) * SOURCE_BYTES, SOURCE_BYTES);
      samples[frame] = sample / 0x80_00_00 / DECODE_HEADROOM;
    }
  }
  return Effect.succeed(stereo);
}

/** Removes a file or folder the script made, as a typed failure if it cannot. */
function remove(path: string): Effect.Effect<void, CleanupFailed> {
  return Effect.try({
    try: () => rmSync(path, { recursive: true, force: true }),
    catch: (cause) => new CleanupFailed({ path, cause }),
  });
}

/** Makes the folder the decode writes into. */
const makeScratch = Effect.try({
  try: () => mkdtempSync(join(tmpdir(), "fuse-music-")),
  catch: (cause) => new WriteFailed({ path: tmpdir(), cause }),
});

/**
 * Decodes the track into `scratch` at 48 kHz stereo with the FFmpeg Remotion ships, so no system
 * FFmpeg is needed, and reads it back. The spawn is scoped, so an interrupt kills FFmpeg's process
 * group and waits for it before the scratch folder is removed.
 */
const decode = Effect.fnUntraced(function* (source: string, scratch: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const decoded = join(scratch, "decoded.wav");
  const command = ChildProcess.make(
    "remotion",
    [
      "ffmpeg",
      "-v",
      "error",
      "-y",
      "-i",
      source,
      "-ac",
      String(CHANNELS),
      "-ar",
      String(SAMPLE_RATE),
      "-af",
      `volume=${String(DECODE_HEADROOM)}`,
      "-c:a",
      "pcm_s24le",
      decoded,
    ],
    { stdin: "ignore", stdout: "ignore", forceKillAfter: "2 seconds" }
  );
  yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner
        .spawn(command)
        .pipe(Effect.mapError((cause) => new DecoderUnavailable({ cause })));
      const stderr = yield* handle.stderr.pipe(
        Stream.decodeText(),
        Stream.mkString,
        Effect.orElseSucceed(() => "")
      );
      const status = yield* handle.exitCode.pipe(
        Effect.mapError((cause) => new DecodeFailed({ status: undefined, stderr: stderr.trim(), cause }))
      );
      if (status !== 0) {
        return yield* Effect.fail(new DecodeFailed({ status, stderr: stderr.trim() }));
      }
    })
  );
  const wav = yield* Effect.try({
    try: () => readFileSync(decoded),
    catch: (cause) => new UnreadableDecode({ reason: `${decoded} could not be read`, cause }),
  });
  return yield* parseDecodedWav(wav);
});

/**
 * Fails if the decoded track ends before the last sample an edit reads, as a partial download
 * does. From here on every sample the edit reads exists.
 */
function proveSpan(source: Stereo, edit: MusicEdit): Effect.Effect<MusicEdit, InsufficientSource> {
  const { needed } = editSpan(edit, SAMPLE_RATE);
  const got = source[0].length;
  return got < needed
    ? Effect.fail(new InsufficientSource({ needed: needed / SAMPLE_RATE, got: got / SAMPLE_RATE }))
    : Effect.succeed(edit);
}

/** The gain that puts the edit's loudest sample at {@link PEAK_DBFS}. */
function normalisingGain(stereo: Stereo): number {
  const peak = Math.max(
    ...stereo.map((channel) => channel.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0))
  );
  return 10 ** (PEAK_DBFS / 20) / peak;
}

/** Encodes 16-bit stereo PCM WAV. */
function encode([left, right]: Stereo): Buffer {
  const frames = left.length;
  const bytes = frames * CHANNELS * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + bytes, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(CHANNELS, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
  wav.writeUInt16LE(CHANNELS * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(bytes, 40);
  for (let frame = 0; frame < frames; frame++) {
    for (const [channel, samples] of [left, right].entries()) {
      const value = Math.max(-1, Math.min(1, itemAt(samples, frame)));
      wav.writeInt16LE(Math.round(value * 0x7f_ff), 44 + (frame * CHANNELS + channel) * 2);
    }
  }
  return wav;
}

/**
 * Writes beside the target, then renames into place, so a failed run never replaces a good cut.
 * Whatever happens, the partial file is removed after; once renamed there is nothing to remove.
 */
function writeAtomically(target: string, contents: Buffer): Effect.Effect<void, WriteFailed | CleanupFailed> {
  const partial = `${target}.partial`;
  return Effect.try({
    try: () => {
      writeFileSync(partial, contents);
      renameSync(partial, target);
    },
    catch: (cause) => new WriteFailed({ path: target, cause }),
  }).pipe(Effect.onExit(() => remove(partial)));
}

/** Mixes, normalises and writes one edit, whose span `proveSpan` has proved. */
const writeCut = Effect.fnUntraced(function* (source: Stereo, edit: MusicEdit) {
  const edited = mixEdit(source, edit, SAMPLE_RATE);
  const gain = normalisingGain(edited);
  const target = join("public", edit.file);
  const [left, right] = edited;
  yield* writeAtomically(
    target,
    encode([left.map((sample) => sample * gain), right.map((sample) => sample * gain)])
  );
  // Logged once the rename has happened, so a later cleanup failure cannot hide or fake the write.
  yield* Console.log(
    `Wrote ${target}: ${edit.duration.toFixed(3)} s, gain ${(20 * Math.log10(gain)).toFixed(2)} dB to a ${String(PEAK_DBFS)} dBFS peak.`
  );
});

/**
 * Decodes into `scratch` and proves the source covers every edit before it writes any, so a
 * partial download leaves every existing cut unchanged; then mixes and writes each.
 */
const cutInto = Effect.fnUntraced(function* (scratch: string) {
  const source = yield* decode(SOURCE, scratch);
  const proved = yield* Effect.forEach(EDITS, (edit) => proveSpan(source, edit));
  yield* Effect.forEach(proved, (edit) => writeCut(source, edit), { discard: true });
});

/**
 * The whole run. The scratch folder is removed after the cut is written, or after an interrupt
 * once FFmpeg has exited, so a cleanup failure after a good run leaves the new cut in place. A cleanup failure after a failed run joins that
 * failure in the cause instead of replacing it.
 */
const cutMusic = Effect.gen(function* () {
  if (!existsSync(SOURCE)) {
    return yield* Effect.fail(new MissingSource({ path: SOURCE }));
  }
  return yield* Effect.acquireUseRelease(makeScratch, cutInto, remove);
});

/** FFmpeg's last lines of output, which name the error; a corrupt file repeats one line hundreds of times. */
function tail(stderr: string): string {
  const lines = stderr.split("\n").filter((line) => line !== "");
  return lines.length === 0 ? "" : `\nFFmpeg's last output:\n${lines.slice(-6).join("\n")}`;
}

/** One message per failure, for the person running the script. */
function describe(failure: CutFailure): string {
  switch (failure._tag) {
    case "MissingSource":
      return `${failure.path} is missing. Download the track first, as apps/video/AGENTS.md describes.`;
    case "DecoderUnavailable":
      return `Could not start \`remotion ffmpeg\` (${String(failure.cause)}). Run the script through \`pnpm music:cut\` after \`pnpm install\`.`;
    case "DecodeFailed":
      return `FFmpeg could not decode ${SOURCE} (${failure.status === undefined ? String(failure.cause) : `exit status ${String(failure.status)}`}). Download the track again.${tail(failure.stderr)}`;
    case "UnreadableDecode":
      return `The decoded track could not be read: ${failure.reason}.`;
    case "InsufficientSource":
      return `${SOURCE} decodes to ${failure.got.toFixed(3)} s, but the edit reads up to ${failure.needed.toFixed(3)} s. The download is probably partial; download the track again. Every existing cut was left unchanged.`;
    case "WriteFailed":
      return `Could not write ${failure.path}: ${String(failure.cause)}. That cut was left unchanged.`;
    case "CleanupFailed":
      return `Could not remove ${failure.path} (${String(failure.cause)}). Delete it by hand.`;
  }
}

/**
 * A failed run's report: every reason in the cause, in its order, so the original failure, defect
 * or interrupt comes first and any cleanup failure after it.
 */
function describeCause(cause: Cause.Cause<CutFailure>): string {
  return cause.reasons
    .map((reason) => {
      if (Cause.isFailReason(reason)) {
        return describe(reason.error);
      }
      if (Cause.isDieReason(reason)) {
        return `Defect: ${reason.defect instanceof Error ? (reason.defect.stack ?? reason.defect.message) : String(reason.defect)}`;
      }
      return "Interrupted.";
    })
    .join("\n");
}

/**
 * A failure already printed: the runtime exits with its status without logging it again. An
 * interrupted run keeps the 130 a Ctrl-C exit has.
 */
class ReportedFailure extends Data.TaggedError("ReportedFailure")<{ readonly exitCode: 1 | 130 }> {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = this.exitCode;
}

// The Node runtime turns Ctrl-C into an interrupt, so FFmpeg is killed and the scratch folder
// removed before the process exits. Only the run itself is interruptible: the report runs to the
// end, so a cleanup failure after Ctrl-C still names the leftover.
Effect.uninterruptibleMask((restore) =>
  restore(cutMusic).pipe(
    Effect.catchCause((cause) =>
      Console.error(describeCause(cause)).pipe(
        Effect.andThen(Effect.fail(new ReportedFailure({ exitCode: Cause.hasInterrupts(cause) ? 130 : 1 })))
      )
    )
  )
).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
