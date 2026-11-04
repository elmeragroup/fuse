import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readWorkflow, requiredJobSteps, requiredRunStep } from "./workflow.mjs";

// Unit under test: the browser legs' system-package installer. Oracle: the deb-cache contract
// in merge.yml and apt's behavior on the runner. Only root, apt, `timeout` and Playwright's
// installer are replaced; the script's branches, archive handling and GitHub output execute
// unchanged.
const script = fileURLToPath(new URL("../.github/scripts/install-playwright-deps.sh", import.meta.url));

/**
 * The fakes record each call in the trace as `<tool> root=<0|1> <args>`. `sudo` marks its
 * command as root; apt-get keeps an offline install to .debs in its archive, as the real one
 * does with --no-download; Playwright refuses anything but a download-only run, since stopping a
 * timed-out install could interrupt dpkg.
 */
const fakes = {
  sudo: `FAKE_ROOT=1 exec "$@"`,
  "apt-config": `[ "$#" = 3 ] && [ "$1" = shell ] && [ "$3" = Dir::Cache::archives/d ] || exit 2
echo "$2='$TEST_ARCHIVE/'"`,
  "apt-get": `echo "apt-get root=\${FAKE_ROOT:-0} $*" >> "$TEST_TRACE"
case "$1" in
  clean) rm -f "$TEST_ARCHIVE"/*.deb ;;
  install)
    n=$(cat "$TEST_STATE/installs")
    echo $((n + 1)) > "$TEST_STATE/installs"
    [ "$n" -ge "$TEST_REJECTED_INSTALLS" ] || exit 100
    for arg; do
      case "$arg" in *.deb) [ "$(dirname "$arg")" = "$TEST_ARCHIVE" ] && [ -f "$arg" ] || exit 100 ;; esac
    done ;;
  *) exit 2 ;;
esac`,
  // GNU timeout reads a duration as a number with an optional s, m, h or d suffix, and 0
  // disables the limit or the kill. Anything else fails as timeout's own error (125), before
  // any attempt; the trace records the accepted limit and grace in seconds.
  timeout: `seconds() {
  awk -v d="$1" 'BEGIN {
    if (d !~ /^([0-9]+[.]?[0-9]*|[.][0-9]+)[smhd]?$/ || d + 0 <= 0) exit 1
    u = substr(d, length(d))
    print (d + 0) * (u == "m" ? 60 : u == "h" ? 3600 : u == "d" ? 86400 : 1)
  }'
}
grace=""
while [ "\${1#-}" != "$1" ]; do
  case "$1" in
    --kill-after=*) grace=$(seconds "\${1#--kill-after=}") || exit 125 ;;
    -k | --kill-after) shift; grace=$(seconds "$1") || exit 125 ;;
    *) exit 125 ;;
  esac
  shift
done
[ -n "$grace" ] || exit 125
limit=$(seconds "$1") || exit 125
shift
echo "timeout root=\${FAKE_ROOT:-0} limit=$limit grace=$grace $*" >> "$TEST_TRACE"
n=$(cat "$TEST_STATE/attempts")
echo $((n + 1)) > "$TEST_STATE/attempts"
[ "$n" -ge "$TEST_STALLS" ] || exit 124
exec "$@"`,
};
const playwright = `mode=install
grep -qx 'APT::Get::Download-Only "true";' "\${APT_CONFIG:-/dev/null}" && mode=download-only
echo "playwright root=\${FAKE_ROOT:-0} $mode $*" >> "$TEST_TRACE"
[ "$mode" = download-only ] || exit 3
for deb in $TEST_DOWNLOADS; do touch "$TEST_ARCHIVE/$deb"; done`;

/**
 * Runs the script to completion without blocking the worker, so the cases run side by side.
 * @param {{ cwd: string, env: Record<string, string | undefined>, timeout: number }} options
 * @returns {Promise<{ status: number | null, stdout: string, stderr: string }>}
 */
function bash(options) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [script], options);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

/** @param {string} path @param {string} body */
function executable(path, body) {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
}

/**
 * Writes the fakes once: macOS assesses each new executable on its first run, which costs more
 * than the script itself when every case writes its own.
 */
function writeTools() {
  const directory = mkdtempSync(join(tmpdir(), "fuse-playwright-deps-tools-"));
  const bin = join(directory, "bin");
  const workspace = join(directory, "workspace");
  const playwrightBin = join(workspace, "packages/fuse/node_modules/.bin");
  for (const path of [bin, playwrightBin]) mkdirSync(path, { recursive: true });
  for (const [name, body] of Object.entries(fakes)) executable(join(bin, name), body);
  executable(join(playwrightBin, "playwright"), playwright);
  return { directory, bin, workspace };
}

/** @type {ReturnType<typeof writeTools>} */
let tools;
beforeAll(() => {
  tools = writeTools();
});
afterAll(() => rmSync(tools.directory, { recursive: true, force: true }));

/**
 * @param {{ restored?: string[], downloads?: string[], stalls?: number, rejectedInstalls?: number }} scenario
 */
async function install({ restored, downloads = [], stalls = 0, rejectedInstalls = 0 }) {
  const directory = mkdtempSync(join(tmpdir(), "fuse-playwright-deps-"));
  const archive = join(directory, "archive");
  const state = join(directory, "state");
  const debs = join(directory, "debs");
  const output = join(directory, "output");
  const trace = join(directory, "trace");
  for (const path of [archive, state]) mkdirSync(path);
  writeFileSync(join(state, "installs"), "0");
  writeFileSync(join(state, "attempts"), "0");
  writeFileSync(output, "");
  writeFileSync(trace, "");
  if (restored !== undefined) {
    mkdirSync(debs);
    for (const deb of restored) writeFileSync(join(debs, deb), deb);
  }
  try {
    const result = await bash({
      cwd: tools.workspace,
      timeout: 5_000,
      env: {
        PATH: `${tools.bin}:/usr/bin:/bin`,
        CACHE_HIT: restored === undefined ? "false" : "true",
        DEBS: debs,
        GITHUB_OUTPUT: output,
        TEST_ARCHIVE: archive,
        TEST_STATE: state,
        TEST_TRACE: trace,
        TEST_DOWNLOADS: downloads.join(" "),
        TEST_STALLS: String(stalls),
        TEST_REJECTED_INSTALLS: String(rejectedInstalls),
      },
    });
    const calls = readFileSync(trace, "utf8").split("\n").filter(Boolean);
    return {
      ...result,
      calls,
      installs: calls
        .filter((call) => call.startsWith("apt-get root=1 install "))
        .map((call) => call.split(" ").filter((arg) => arg.endsWith(".deb"))),
      archive,
      cached: existsSync(debs) ? readdirSync(debs).sort() : undefined,
      outputs: readFileSync(output, "utf8").split("\n").filter(Boolean),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The offline install apt-get receives for the given archive files. */
const offlineInstall = "apt-get root=1 install -y --no-install-recommends --no-download ";
/** The single download Playwright's installer runs, as root and without dpkg. */
const download = "playwright root=1 download-only install-deps chromium firefox webkit";

describe.concurrent("Playwright system package install", () => {
  it("installs a restored set offline without contacting the mirror", async () => {
    const result = await install({ restored: ["a.deb", "b.deb"] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.filter((call) => !call.startsWith("apt-get "))).toEqual([]);
    expect(result.calls.filter((call) => call.startsWith(offlineInstall))).toHaveLength(1);
    expect(result.installs).toEqual([[join(result.archive, "a.deb"), join(result.archive, "b.deb")]]);
    expect(result.outputs).toEqual([]);
  });

  it("downloads from the mirror, installs offline and offers the set for saving on a miss", async () => {
    const result = await install({ downloads: ["a.deb", "b.deb"] });
    expect(result.status, result.stderr).toBe(0);
    const timed = result.calls.filter((call) => call.startsWith("timeout "));
    expect(timed).toHaveLength(1);
    // Root runs the time limit, so it can stop the root apt processes beneath it.
    expect(timed[0]).toMatch(/^timeout root=1 /);
    expect(result.calls).toContain(download);
    expect(result.installs).toEqual([[join(result.archive, "a.deb"), join(result.archive, "b.deb")]]);
    expect(result.calls.findIndex((call) => call === download)).toBeLessThan(
      result.calls.findIndex((call) => call.startsWith(offlineInstall))
    );
    expect(result.cached).toEqual(["a.deb", "b.deb"]);
    expect(result.outputs).toEqual(["save=true"]);
  });

  it("retries a stalled download once and still installs and saves the set", async () => {
    const result = await install({ downloads: ["a.deb"], stalls: 1 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.filter((call) => call.startsWith("timeout "))).toHaveLength(2);
    expect(result.stdout).toContain("::warning::");
    expect(result.installs).toEqual([[join(result.archive, "a.deb")]]);
    expect(result.outputs).toEqual(["save=true"]);
  });

  it("fails after a second stall without installing or saving", async () => {
    const result = await install({ downloads: ["a.deb"], stalls: 2 });
    expect(result.status).not.toBe(0);
    const timed = result.calls.filter((call) => call.startsWith("timeout "));
    expect(timed).toHaveLength(2);
    expect(result.installs).toEqual([]);
    expect(result.cached).toBeUndefined();
    expect(result.outputs).toEqual([]);

    // Cross-check against merge.yml: both attempts, each with its kill grace, must end inside
    // the step's own limit, or a second stall reaches the backstop before the retry finishes.
    const deps = requiredRunStep(
      requiredJobSteps(readWorkflow("merge"), "browser"),
      "bash .github/scripts/install-playwright-deps.sh"
    );
    const stepSeconds = Number(deps["timeout-minutes"]) * 60;
    const attemptSeconds = timed.map((call) => {
      const match = /^timeout root=1 limit=([\d.]+) grace=([\d.]+) /.exec(call);
      if (match === null) throw new Error(`unbounded attempt: ${call}`);
      return Number(match[1]) + Number(match[2]);
    });
    expect(attemptSeconds.reduce((total, seconds) => total + seconds, 0)).toBeLessThan(stepSeconds);
  });

  it("downloads afresh when apt rejects the restored set, installing none of it", async () => {
    const result = await install({ restored: ["stale.deb"], downloads: ["fresh.deb"], rejectedInstalls: 1 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("::warning::");
    expect(result.calls).toContain(download);
    expect(result.installs).toEqual([
      [join(result.archive, "stale.deb")],
      [join(result.archive, "fresh.deb")],
    ]);
  });

  it("saves nothing when every package is already installed", async () => {
    const result = await install({ downloads: [] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toContain(download);
    expect(result.installs).toEqual([]);
    expect(result.outputs).toEqual([]);
  });

  it("fails without saving when the downloaded set does not install", async () => {
    const result = await install({ downloads: ["a.deb"], rejectedInstalls: 1 });
    expect(result.status).not.toBe(0);
    expect(result.outputs).toEqual([]);
  });
});
