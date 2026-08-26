// CI-only: drives the actually-installed packaged Windows app (not the dev
// server, not a cross-compiled artifact) through the real IPC/HTTP surface a
// user would hit, to verify the bundled Python/FFmpeg/Whisper runtime works
// with no system Python, FFmpeg, Node, or yt-dlp installed by this workflow.
import { _electron as electron } from "playwright";
import { readFileSync } from "node:fs";

const [, , exePath, mp4Path] = process.argv;
if (!exePath || !mp4Path) {
  console.error("Usage: node scripts/ci-windows-smoke-test.mjs <installed-app.exe> <test.mp4>");
  process.exit(1);
}

function log(step, detail) {
  console.log(`[smoke-test] ${step}${detail !== undefined ? ": " + JSON.stringify(detail) : ""}`);
}

async function main() {
  log("launching installed app", exePath);
  const app = await electron.launch({
    executablePath: exePath,
    args: ["--disable-gpu"],
    timeout: 60_000,
  });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    const isElectron = await window.evaluate(() => window.desktop?.isElectron === true);
    if (!isElectron) {
      throw new Error("window.desktop bridge is missing -- preload/contextBridge did not run");
    }
    log("desktop bridge present", isElectron);

    const checkResult = await window.evaluate(() => window.desktop.models.check());
    log("models:check result", checkResult);
    if (!Array.isArray(checkResult?.missing)) {
      throw new Error(
        "models:check did not return {missing:[...]} -- the packaged ensure_models runtime did not run correctly"
      );
    }

    log("running models:ensure -- downloads real Whisper weights over the network...");
    const ensureResult = await window.evaluate(() => window.desktop.models.ensure());
    log("models:ensure result", ensureResult);
    if (ensureResult?.ok !== true) {
      throw new Error(`models:ensure did not resolve {ok:true}: ${JSON.stringify(ensureResult)}`);
    }

    const recheck = await window.evaluate(() => window.desktop.models.check());
    log("models:check after ensure", recheck);
    if (recheck.missing.length !== 0) {
      throw new Error(`models still reported missing after ensure: ${JSON.stringify(recheck.missing)}`);
    }

    log("submitting synthetic mp4 to /api/transcribe (exercises ffmpeg-static + frozen transcribe.exe)...");
    const mp4Base64 = readFileSync(mp4Path).toString("base64");
    const transcribeResult = await window.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const file = new File([bytes], "smoke-test.mp4", { type: "video/mp4" });
      const form = new FormData();
      form.append("file", file);
      form.append("outputFormat", "original");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      return { status: res.status, ok: res.ok, body };
    }, mp4Base64);

    log("/api/transcribe response", transcribeResult);
    if (!transcribeResult.ok || !Array.isArray(transcribeResult.body?.segments)) {
      throw new Error(`/api/transcribe failed or returned an unexpected shape: ${JSON.stringify(transcribeResult)}`);
    }

    log(
      "SUCCESS: bundled Python/FFmpeg/Whisper runtime transcribed a real file end-to-end " +
        "on this Windows machine, with no system Python/FFmpeg/yt-dlp installed by this app."
    );
  } finally {
    await app.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[smoke-test] FAILED:", err);
  process.exit(1);
});
