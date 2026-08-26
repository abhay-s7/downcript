import { existsSync } from "node:fs";
import path from "node:path";

// The web deployment (Render) has yt-dlp installed on PATH via the Docker
// image's venv, so it keeps invoking the bare command. The desktop build has
// no such install, so it ships yt-dlp's own official standalone binary (see
// scripts/download-yt-dlp.sh) and this resolves to that instead -- same call
// site, same behavior, whichever context it runs in.
const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;
const projectRoot = process.env.PROJECT_ROOT || process.cwd();

function platformDir(): string {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  return "linux";
}

function exeName(): string {
  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

export function resolveYtDlp(): string {
  const name = exeName();
  const dir = platformDir();

  const candidates = [
    // Packaged Electron app: bundled via electron-builder's extraResources.
    resourcesPath ? path.join(resourcesPath, "yt-dlp", dir, name) : null,
    // Local download produced by scripts/download-yt-dlp.sh, before
    // packaging wires up extraResources.
    path.join(projectRoot, "vendor", "yt-dlp", dir, name),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((p) => existsSync(/* turbopackIgnore: true */ p));
  if (found) return found;

  // Same reasoning as app/lib/pythonRuntime.ts: a packaged build must never
  // fall back to a bare "yt-dlp" -- on a clean machine that command simply
  // doesn't exist, and failing clearly beats a raw "ENOENT" from a command
  // that was never supposed to be looked up on PATH in the first place.
  if (process.env.ELECTRON_IS_PACKAGED === "1") {
    throw new Error(
      "Local yt-dlp runtime is missing from this installation. " +
        "This is a packaging defect, not something fixable by installing yt-dlp."
    );
  }

  // Dev-mode convenience / web deployment (Render has yt-dlp on PATH).
  return "yt-dlp";
}
