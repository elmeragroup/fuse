import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(docsRoot, "node_modules/next/dist/bin/next");

export type DocsServer = {
  url: string;
  close: () => Promise<void>;
};

async function reservePort(): Promise<number> {
  const server = createServer();
  return await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = listeningPort(address);
      if (port === null) {
        server.close();
        reject(new Error("Could not reserve a TCP port"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`docs production server exited before becoming ready (${String(child.exitCode)})`);
    }
    try {
      const response = await fetch(url, { redirect: "manual" });
      await response.arrayBuffer();
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still binding.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`docs production server did not become ready at ${url}`);
}

export async function startDocsProductionServer(): Promise<DocsServer> {
  const port = await reservePort();
  const url = `http://127.0.0.1:${String(port)}`;
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: docsRoot,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  try {
    await waitForServer(url, child);
  } catch (error) {
    child.kill("SIGKILL");
    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    throw new Error(
      `${error instanceof Error ? error.message : "docs production server failed to start"}${
        stderr === "" ? "" : `\n${stderr}`
      }`
    );
  }

  return {
    url,
    close: async () => {
      if (child.exitCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}

function listeningPort(address: AddressInfo | string | null): number | null {
  if (address === null || !isAddressInfo(address)) {
    return null;
  }
  return address.port;
}

function isAddressInfo(address: AddressInfo | string): address is AddressInfo {
  return address instanceof Object && Object.hasOwn(address, "port");
}

export function docsBaseUrl(): string {
  const url = process.env.DOCS_BASE_URL;
  if (url === undefined || url === "") {
    throw new Error("DOCS_BASE_URL is missing. Vitest globalSetup must start the docs production server.");
  }
  return url;
}
