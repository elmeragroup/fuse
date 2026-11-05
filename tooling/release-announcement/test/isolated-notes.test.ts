import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Clock, ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import * as IsolatedNotes from "../src/isolated-notes.ts";
import { NotesRenderer } from "../src/release-announcement.ts";
import { StableVersion } from "../src/release-record.ts";

// Unit under test: the notes renderer adapter, with the process it starts swapped for a stand-in
// script run by the real process spawner, with the options the adapter chose. Oracles: what a
// stand-in may answer (at most four sections, each 1 to 3000 characters, in at most 64 KiB of
// output, within the ten-second default time limit), and the environment a process started that
// way gets.

/** The step's process spawner, with every process it starts running `script` instead. */
const standIn = (script: string) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const real = yield* ChildProcessSpawner.ChildProcessSpawner;
      return ChildProcessSpawner.make((command) =>
        command._tag === "StandardCommand"
          ? real.spawn(
              ChildProcess.make(command.command, ["--input-type=module", "-e", script], command.options)
            )
          : real.spawn(command)
      );
    })
  ).pipe(Layer.provide(NodeServices.layer));

/**
 * The renderer as the notify step builds it, its process replaced by `script`. No setting is
 * given, so it runs with its production defaults.
 */
const rendererWith = (script: string) =>
  IsolatedNotes.layer.pipe(
    Layer.provide(standIn(script)),
    Layer.provide(NodeServices.layer),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))
  );

const render = (script: string) =>
  Effect.gen(function* () {
    const renderer = yield* NotesRenderer;
    return yield* renderer.render(
      { _tag: "Whole", text: "## 1.0.0\n\n- Note.\n" },
      StableVersion.make("1.0.0")
    );
  }).pipe(Effect.provide(rendererWith(script)));

/** What a stand-in may answer: notes, or anything else a broken process could write. */
type Answer = { readonly _tag: string; readonly sections?: readonly string[] };

/** A stand-in that reads the request and answers `answer`, as JSON. */
const answering = (answer: Answer) =>
  `process.stdin.resume(); process.stdin.on("end", () => process.stdout.write(${JSON.stringify(JSON.stringify(answer))}));`;

const notes = (sections: readonly string[]) =>
  ({ _tag: "Notes", sections, extent: { _tag: "Whole" } }) as const;

layer(NodeServices.layer, { excludeTestServices: true })("the notes renderer's process", (it) => {
  it.effect("gets none of the step's environment", () =>
    Effect.gen(function* () {
      // The stand-in answers with the names of the variables it sees as its one section.
      const read = yield* render(
        `process.stdin.resume(); process.stdin.on("end", () => process.stdout.write(JSON.stringify({ _tag: "Notes", sections: [JSON.stringify(Object.keys(process.env)) || "[]"], extent: { _tag: "Whole" } })));`
      );
      assert.strictEqual(read._tag, "Notes");
      const keys: unknown = JSON.parse(read._tag === "Notes" ? (read.sections[0] ?? "") : "");
      // macOS adds its text encoding to every process it starts; nothing else may be there.
      assert.deepStrictEqual(
        Array.isArray(keys) ? keys.filter((key) => key !== "__CF_USER_TEXT_ENCODING") : keys,
        []
      );
    })
  );

  it.effect("is answered with up to four sections of up to 3000 characters", () =>
    Effect.gen(function* () {
      const sections = ["a", "b".repeat(3000), "c", "d"];
      assert.deepStrictEqual(yield* render(answering(notes(sections))), notes(sections));
      assert.deepStrictEqual(yield* render(answering(notes([]))), notes([]));
    })
  );

  it.effect.each([
    { case: "a section of 3001 characters", answer: notes(["x".repeat(3001)]) },
    { case: "an empty section", answer: notes([""]) },
    { case: "five sections", answer: notes(["a", "b", "c", "d", "e"]) },
    { case: "something other than notes", answer: { _tag: "Posted" } },
  ])("is not believed when it answers $case", ({ answer }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* render(answering(answer)), {
        _tag: "Unreadable",
        cause: "renderer-failed",
      });
    })
  );

  it.effect.each([
    // The answer is padded with spaces, which the adapter trims, to the byte count.
    { case: "exactly 64 KiB", bytes: 65_536, read: notes(["a"]) },
    {
      case: "one byte past 64 KiB",
      bytes: 65_537,
      read: { _tag: "Unreadable", cause: "answer-too-large" } as const,
    },
  ])("reads an answer of $case as $read._tag", ({ bytes, read }) =>
    Effect.gen(function* () {
      const answer = JSON.stringify(notes(["a"]));
      const padded = `${answer}${" ".repeat(bytes - answer.length)}`;
      assert.strictEqual(Buffer.byteLength(padded), bytes);
      assert.deepStrictEqual(
        yield* render(
          `process.stdin.resume(); process.stdin.on("end", () => process.stdout.write(${JSON.stringify(padded)}));`
        ),
        read
      );
    })
  );

  it.effect("stops reading, and stops the process, when it writes more than an answer can hold", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const pidFile = path.join(dir, "pid");
      // 32 MiB, written as fast as the pipe takes it, then the process waits to be stopped.
      const read = yield* render(
        `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); const chunk = "x".repeat(1 << 20); let left = 32; const write = () => { while (left > 0) { left -= 1; if (!process.stdout.write(chunk)) { process.stdout.once("drain", write); return; } } setInterval(() => {}, 1000); }; write();`
      );
      assert.deepStrictEqual(read, { _tag: "Unreadable", cause: "answer-too-large" });
      assert.isFalse(isAlive(Number(yield* fs.readFileString(pidFile))));
    })
  );

  it.effect("stops a process that has not answered within the time limit", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const pidFile = path.join(dir, "pid");
      // A synchronous loop, as a parse is, which no signal but SIGKILL ends.
      const started = yield* Clock.currentTimeMillis;
      const read = yield* render(
        `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); for (;;) {}`
      );
      assert.deepStrictEqual(read, { _tag: "Unreadable", cause: "over-budget" });
      // The default limit is ten seconds (RELEASE.md), and a timer never fires before its time;
      // the 10 ms allow for the clock's rounding. The test's own timeout bounds it from above.
      assert.isAtLeast((yield* Clock.currentTimeMillis) - started, 9_990);
      assert.isFalse(isAlive(Number(yield* fs.readFileString(pidFile))));
    })
  );

  it.effect("is not believed when it fails", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* render("process.exit(3);"), {
        _tag: "Unreadable",
        cause: "renderer-failed",
      });
    })
  );
});

/** Whether a process is still running. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
