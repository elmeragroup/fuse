/**
 * The skills the server ships, one per folder of the skills directory. The server serves each as
 * `skill://<folder>/SKILL.md` with every file in its folder. It reads the files once at startup
 * and serves the bytes it read, so a skill's digest changes only when its files do.
 */

import * as McpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { ServerConfig } from "./config.ts";

/** Reading a skill folder failed, or the folder holds no `SKILL.md`. */
export class SkillUnreadable extends Schema.TaggedError<SkillUnreadable>()("SkillUnreadable", {
  message: Schema.String,
  path: Schema.String,
  cause: Schema.Defect(),
}) {}

/** A skill breaks a rule of the Skills extension, such as a frontmatter name that differs from its folder. */
export class SkillInvalid extends Schema.TaggedError<SkillInvalid>()("SkillInvalid", {
  message: Schema.String,
  skill: Schema.String,
}) {}

/** One skill, read from its folder. */
export type Skill = {
  /** The folder's name, which is the skill's name and the last segment of its URI. */
  readonly name: string;
  /** The `skill://` URI of its `SKILL.md`. */
  readonly uri: string;
  /** Each file's bytes, by its path inside the folder. */
  readonly files: { readonly "SKILL.md": Uint8Array } & Readonly<Record<string, Uint8Array>>;
};

/** Whether a path inside a skill names a dotfile or lies in a dot folder, such as `.DS_Store`. */
function isHidden(relative: string): boolean {
  return relative.split(/[\\/]/u).some((segment) => segment.startsWith("."));
}

/**
 * Reads every skill under `FUSE_SKILLS_DIR`, in name order. A directory with no folders gives no
 * skills. A missing directory fails startup, because only a broken image lacks one.
 */
export const loadSkills = Effect.gen(function* () {
  const { skillsDirectory } = yield* ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const unreadable = (at: string) => (cause: unknown) =>
    new SkillUnreadable({ message: `Reading the skill path ${at} failed.`, path: at, cause });
  const entries = yield* fs
    .readDirectoryEntries(skillsDirectory)
    .pipe(Effect.mapError(unreadable(skillsDirectory)));
  const names = entries
    .filter((entry) => entry.type === "Directory" && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  return yield* Effect.forEach(
    names,
    (name) =>
      Effect.gen(function* () {
        const root = path.join(skillsDirectory, name);
        const listed = yield* fs
          .readDirectory(root, { recursive: true })
          .pipe(Effect.mapError(unreadable(root)));
        const files: Record<string, Uint8Array> = {};
        for (const relative of listed.filter((entry) => !isHidden(entry)).sort()) {
          const file = path.join(root, relative);
          const info = yield* fs.stat(file).pipe(Effect.mapError(unreadable(file)));
          if (info.type !== "File") continue;
          files[relative.split(path.sep).join("/")] = yield* fs
            .readFile(file)
            .pipe(Effect.mapError(unreadable(file)));
        }
        const skill = files["SKILL.md"];
        if (skill === undefined) {
          return yield* new SkillUnreadable({
            message: `The skill folder ${root} holds no SKILL.md.`,
            path: root,
            cause: undefined,
          });
        }
        return {
          name,
          uri: `skill://${name}/SKILL.md`,
          files: { ...files, "SKILL.md": skill },
        } satisfies Skill;
      }),
    { concurrency: 1 }
  );
});

/**
 * Registers skills on the server.
 *
 * @param skills - The skills from {@link loadSkills}.
 * @returns A layer that registers each one, failing with `SkillInvalid` on the first the Skills
 *   extension rejects.
 */
export function skillsLayer(skills: readonly Skill[]) {
  return Layer.effectDiscard(
    Effect.forEach(
      skills,
      (skill) =>
        McpServer.registerSkill({ uri: skill.uri, files: skill.files }).pipe(
          Effect.mapError(
            (error) =>
              new SkillInvalid({ message: `The skill ${skill.name}: ${error.message}`, skill: skill.name })
          )
        ),
      { concurrency: 1, discard: true }
    )
  );
}
