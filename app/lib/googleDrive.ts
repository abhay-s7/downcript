import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import * as cheerio from "cheerio";

// Public Google Drive folders cannot be listed through the official Drive API
// without an OAuth-scoped identity: `files.list` always resolves against a
// user's/corpus's Drive and rejects API-key-only requests with a login error,
// even when the folder itself is shared "Anyone with the link". The only
// anonymous enumeration path is the same one browsers use for the embedded
// folder preview widget, which returns plain HTML for public folders. This
// mirrors the approach used by the well-known `gdown` tool.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface DriveFileRef {
  id: string;
  name: string;
}

export class DriveFolderNotPublicError extends Error {}

export function extractFolderId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "drive.google.com") return null;
    const match = parsed.pathname.match(/\/folders\/([-\w]{10,})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function extractResourceKey(url: string): string | null {
  try {
    return new URL(url.trim()).searchParams.get("resourcekey");
  } catch {
    return null;
  }
}

class CookieJar {
  private cookies = new Map<string, string>();

  apply(response: Response) {
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const pair = raw.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

async function fetchWithJar(jar: CookieJar, url: string, signal?: AbortSignal): Promise<Response> {
  const cookieHeader = jar.header();
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    redirect: "manual",
    signal,
  });
  jar.apply(res);

  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get("location");
    if (location) {
      const nextUrl = new URL(location, url);
      if (nextUrl.hostname.includes("accounts.google.com")) {
        return res;
      }
      return fetchWithJar(jar, nextUrl.toString(), signal);
    }
  }

  return res;
}

export async function scanPublicFolder(
  folderId: string,
  resourceKey: string | null
): Promise<DriveFileRef[]> {
  const jar = new CookieJar();
  const params = new URLSearchParams({ id: folderId });
  if (resourceKey) params.set("resourcekey", resourceKey);

  const url = `https://drive.google.com/embeddedfolderview?${params.toString()}`;
  const res = await fetchWithJar(jar, url);

  const finalHost = new URL(res.url || url).hostname;
  if (finalHost.includes("accounts.google.com")) {
    throw new DriveFolderNotPublicError();
  }
  if (!res.ok) {
    throw new DriveFolderNotPublicError();
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  if (!title) {
    throw new DriveFolderNotPublicError();
  }

  const files: DriveFileRef[] = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/^https:\/\/drive\.google\.com\/file\/d\/([-\w]{10,})\/view/);
    if (!match) return;
    const name = $(el).text().replace(/\s+/g, " ").trim();
    if (name) files.push({ id: match[1], name });
  });

  return files;
}

function extractConfirmUrl(html: string): string | null {
  let m = html.match(/href="(\/uc\?export=download[^"]+)"/);
  if (m) return ("https://drive.google.com" + m[1]).replace(/&amp;/g, "&");

  const $ = cheerio.load(html);
  const form = $("#download-form");
  if (form.length) {
    const action = form.attr("action");
    if (action) {
      const url = new URL(action.replace(/&amp;/g, "&"));
      form.find('input[type="hidden"]').each((_, input) => {
        const name = $(input).attr("name");
        const value = $(input).attr("value");
        if (name) url.searchParams.set(name, value || "");
      });
      return url.toString();
    }
  }

  m = html.match(/"downloadUrl":"([^"]+)"/);
  if (m) return m[1].replace(/\\u003d/g, "=").replace(/\\u0026/g, "&");

  m = html.match(/<p class="uc-error-subcaption">(.*?)<\/p>/);
  if (m) throw new Error(m[1]);

  return null;
}

export async function downloadDriveFile(
  fileId: string,
  resourceKey: string | null,
  destPath: string,
  signal?: AbortSignal
): Promise<void> {
  const jar = new CookieJar();
  const params = new URLSearchParams({ id: fileId, export: "download" });
  if (resourceKey) params.set("resourcekey", resourceKey);
  let url = `https://drive.google.com/uc?${params.toString()}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetchWithJar(jar, url, signal);

    if (!res.ok) {
      throw new Error(`Google Drive returned status ${res.status}.`);
    }

    const contentDisposition = res.headers.get("content-disposition");
    const contentType = res.headers.get("content-type") || "";

    if (contentDisposition || !contentType.startsWith("text/html")) {
      if (!res.body) throw new Error("Empty response body from Google Drive.");
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(destPath), { signal });
      return;
    }

    const html = await res.text();
    const nextUrl = extractConfirmUrl(html);
    if (!nextUrl) {
      throw new Error("Could not resolve a download link for this Google Drive file.");
    }
    url = nextUrl;
  }

  throw new Error("Too many redirects while downloading from Google Drive.");
}
