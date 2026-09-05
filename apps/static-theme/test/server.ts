import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(fixtureRoot, "dist");

export type StaticThemeServer = {
  url: string;
  close: () => Promise<void>;
};

function contentType(filePath: string): string {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".map":
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function requestedFile(urlPath: string): string | null {
  const pathname = decodeURIComponent((urlPath.split("?")[0] ?? "").replace(/\\/g, "/"));
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const resolved = path.resolve(distRoot, relative);
  const prefix = distRoot.endsWith(path.sep) ? distRoot : `${distRoot}${path.sep}`;
  if (resolved !== distRoot && !resolved.startsWith(prefix)) {
    return null;
  }
  return resolved;
}

async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const urlPath = request.url ?? "/";
  const filePath = requestedFile(urlPath);
  if (filePath === null) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": contentType(filePath) });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end();
  }
}

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

function listeningPort(address: AddressInfo | string | null): number | null {
  if (address === null || !isAddressInfo(address)) {
    return null;
  }
  return address.port;
}

function isAddressInfo(address: AddressInfo | string): address is AddressInfo {
  return address instanceof Object && Object.hasOwn(address, "port");
}

export async function startStaticThemeServer(): Promise<StaticThemeServer> {
  const port = await reservePort();
  const url = `http://127.0.0.1:${String(port)}`;
  const server = createServer((request, response) => {
    void respond(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve();
    });
  });

  return {
    url,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

export function staticThemeBaseUrl(): string {
  const url = process.env.STATIC_THEME_BASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "STATIC_THEME_BASE_URL is missing. Vitest globalSetup must start the static theme server."
    );
  }
  return url;
}
