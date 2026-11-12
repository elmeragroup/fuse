// Stands in for `gh` in the Gh tests. Its first argument picks what it does: `hang` writes its
// pid to fake-gh.pid in its working directory and runs until killed, `fail` prints to stderr and
// exits 1, and anything else prints its arguments.
import { writeFileSync } from "node:fs";

const [mode, ...rest] = process.argv.slice(2);
if (mode === "hang") {
  writeFileSync("fake-gh.pid", String(process.pid));
  // oxlint-disable-next-line fuse/no-fixed-delay -- keeps the process alive until the test kills it, with stdin ignored and no other handle; nothing waits on this timer, which never fires within a run
  setTimeout(() => process.exit(0), 2 ** 31 - 1);
} else if (mode === "fail") {
  process.stderr.write("fake gh refused\n");
  process.exitCode = 1;
} else {
  process.stdout.write(`${[mode, ...rest].join(" ")}\n`);
}
