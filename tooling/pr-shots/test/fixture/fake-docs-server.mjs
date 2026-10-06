// Stands in for `next dev` in the docs-server tests: `fake-docs-server.mjs launcher <port>
// <mode>`. Like `next dev`, a launcher rewrites next-env.d.ts in its working directory and starts
// a worker that holds the port. Each process appends `<role> <pid>` to fake-server.log.
//
// - `serve`: the worker answers 200. The launcher ignores SIGTERM, standing in for a launcher
//   that stops without passing the signal on, so only a signal to the whole process group
//   reaches the worker.
// - `hang`: as `serve`, but the worker accepts requests and never answers them.
// - `exit-code` and `exit-signal`: once the worker is up, the launcher exits with code 1, or is
//   killed by SIGKILL. The worker ignores SIGTERM, keeps the port and rewrites next-env.d.ts
//   every 20 ms for as long as it lives, so a restore that runs before it is gone gets undone.
import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const REWRITTEN = "// rewritten by the fake server\n";
const [role, port, mode] = process.argv.slice(2);
const outlivesLauncher = mode === "exit-code" || mode === "exit-signal";
appendFileSync("fake-server.log", `${role} ${process.pid}\n`);

/** Keeps a process alive until it is killed. */
function stayAlive() {
  setTimeout(() => process.exit(0), 2 ** 31 - 1);
}

/** Counts the SIGTERMs a process chooses to ignore. */
function ignoreSigterm() {
  let ignoredSignals = 0;
  process.on("SIGTERM", () => {
    ignoredSignals += 1;
  });
}

if (role === "launcher") {
  writeFileSync("next-env.d.ts", REWRITTEN);
  ignoreSigterm();
  const worker = spawn(process.execPath, [import.meta.filename, "worker", port, mode], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  worker.on("message", () => {
    if (mode === "exit-code") {
      process.exit(1);
    } else if (mode === "exit-signal") {
      process.kill(process.pid, "SIGKILL");
    }
  });
  stayAlive();
} else {
  if (outlivesLauncher) {
    ignoreSigterm();
    setInterval(() => writeFileSync("next-env.d.ts", REWRITTEN), 20);
  }
  createServer((_request, response) => {
    if (mode !== "hang") {
      response.writeHead(200).end("ok");
    }
  }).listen(Number(port), "127.0.0.1", () => {
    process.send?.("listening");
    if (outlivesLauncher) {
      process.disconnect?.();
    }
  });
}
