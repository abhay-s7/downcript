import { existsSync } from "node:fs";
import path from "node:path";

// Downly's browser-download flow got this for free from Chromium's own "(1)"
// suffixing. Writing straight to disk from the server (downloads, Meta
// creatives) has no such safety net, so this is the explicit equivalent:
// never overwrite an existing file, append " (n)" before the extension
// until a free name is found.
export function dedupeFilePath(filePath: string): string {
  // Always a user-chosen destination outside the project tree, never a
  // project-relative lookup -- see destination.ts for why this opts out of
  // Turbopack's build-time tracing rather than pulling in the whole project.
  if (!existsSync(/* turbopackIgnore: true */ filePath)) return filePath;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  let n = 1;
  let candidate: string;
  do {
    candidate = path.join(dir, `${base} (${n})${ext}`);
    n += 1;
  } while (existsSync(/* turbopackIgnore: true */ candidate));

  return candidate;
}
