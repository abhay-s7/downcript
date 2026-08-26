import { existsSync } from "node:fs";
import path from "node:path";

// The web deployment (Render) has python3 + these pip packages installed in
// its Docker image, so it keeps invoking the scripts directly. The desktop
// build has no system Python at all, so it ships transcribe.py/hinglish.py
// frozen into standalone binaries (via PyInstaller, see build-python/) and
// this resolves to those instead -- same call site, same behavior, whichever
// context it runs in.
type FrozenTool = "transcribe" | "hinglish";

// process.resourcesPath only exists when running under Electron; @types/node
// has no knowledge of it, so this is the one place that reaches for it.
const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;

// Electron's main process launches the local server with cwd set to
// .next/standalone (required for the server's own relative asset lookups),
// so this can't be trusted as "the project root" -- main.js passes the real
// root explicitly instead.
const projectRoot = process.env.PROJECT_ROOT || process.cwd();

function frozenBinaryPath(tool: FrozenTool): string | null {
  const exeName = process.platform === "win32" ? `${tool}.exe` : tool;

  const candidates = [
    // Packaged Electron app: bundled via electron-builder's extraResources.
    resourcesPath ? path.join(resourcesPath, "py", tool, exeName) : null,
    // Local build produced by PyInstaller under build-python/, before
    // packaging wires up extraResources. Namespaced by platform since
    // PyInstaller freezes for whatever OS it runs on, not cross-platform.
    path.join(projectRoot, "build-python", "dist", process.platform, tool, exeName),
  ].filter((candidate): candidate is string => Boolean(candidate));

  // These paths are only known at runtime (packaged-vs-dev, per-platform
  // exe name), so this deliberately isn't traceable at build time -- the
  // frozen binaries are shipped separately (extraResources), not bundled
  // into the Next server output.
  return candidates.find((p) => existsSync(/* turbopackIgnore: true */ p)) ?? null;
}

export function resolvePythonTool(
  tool: FrozenTool,
  scriptRelPath: string
): { command: string; args: string[] } {
  const frozen = frozenBinaryPath(tool);
  if (frozen) {
    return { command: frozen, args: [] };
  }

  // A packaged desktop build must never fall back to a system Python -- on a
  // clean machine with no Python installed, Windows silently redirects
  // "python"/"python3" to its Microsoft Store App Execution Alias shim
  // ("Python was not found; run without arguments to install..."), which
  // looks like a user setup problem but is actually a packaging defect (this
  // tool's frozen binary wasn't bundled for this platform). Failing clearly
  // here beats a confusing OS-level error from a command that was never
  // supposed to exist on the user's machine.
  if (process.env.ELECTRON_IS_PACKAGED === "1") {
    throw new Error(
      `Local transcription runtime ("${tool}") is missing from this installation. ` +
        "This is a packaging defect, not something fixable by installing Python."
    );
  }

  // Dev-mode-only convenience: lets a developer iterate against system
  // Python without rebuilding frozen binaries every time. Also what the web
  // deployment (Render) always uses, since it has python3 installed in its
  // Docker image and ELECTRON_IS_PACKAGED is never set there.
  return {
    command: process.platform === "win32" ? "python" : "python3",
    args: [path.join(/* turbopackIgnore: true */ projectRoot, scriptRelPath)],
  };
}
