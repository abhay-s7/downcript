// CI-only: drives the actually-installed packaged Windows app through the
// real Dailymotion flow a user would hit -- POST /api/dailymotion-transcript
// with a real, currently-live public Dailymotion URL, reading the streamed
// ndjson phase events exactly as app/lib/jobs.ts does. This is the piece the
// original Windows smoke test never covered (it only exercised Upload, i.e.
// ffmpeg + Whisper, never yt-dlp), which is why a yt-dlp-specific packaging
// problem could have shipped without CI catching it.
import { _electron as electron } from "playwright";

function log(step, detail) {
  console.log(`[dm-smoke-test] ${step}${detail !== undefined ? ": " + JSON.stringify(detail) : ""}`);
}

async function fetchLiveDailymotionUrl() {
  const res = await fetch("https://api.dailymotion.com/videos?fields=id,url&limit=1");
  if (!res.ok) throw new Error(`Dailymotion API lookup failed: ${res.status}`);
  const body = await res.json();
  const url = body?.list?.[0]?.url;
  if (!url) throw new Error(`Dailymotion API returned no video: ${JSON.stringify(body)}`);
  return url;
}

async function main() {
  const [, , exePath] = process.argv;
  if (!exePath) {
    console.error("Usage: node scripts/ci-windows-dailymotion-smoke-test.mjs <installed-app.exe>");
    process.exit(1);
  }

  const dailymotionUrl = await fetchLiveDailymotionUrl();
  log("using live Dailymotion URL", dailymotionUrl);

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
    if (!isElectron) throw new Error("window.desktop bridge is missing");
    log("desktop bridge present", isElectron);

    log("submitting Dailymotion URL to /api/dailymotion-transcript (exercises bundled yt-dlp.exe)...");
    const outcome = await window.evaluate(async (url) => {
      const res = await fetch("/api/dailymotion-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, outputFormat: "original" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, status: res.status, body, phases: [] };
      }
      if (!res.body) return { ok: false, error: "no response body", phases: [] };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const phases = [];
      let result;
      let error;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.phase) phases.push(msg.phase);
          else if (msg.error) error = msg.error;
          else if (msg.result) result = msg.result;
        }
      }

      return { ok: !error && !!result, phases, error, segments: result?.segments };
    }, dailymotionUrl);

    log("stream outcome", { ok: outcome.ok, phases: outcome.phases, error: outcome.error });

    if (!outcome.ok) {
      throw new Error(
        `Dailymotion flow failed in the packaged app: ${outcome.error || JSON.stringify(outcome.body) || "unknown"}`
      );
    }
    if (!Array.isArray(outcome.segments)) {
      throw new Error(`Dailymotion flow did not return segments: ${JSON.stringify(outcome)}`);
    }

    log(
      "SUCCESS: the packaged app downloaded a live Dailymotion video with the bundled yt-dlp.exe " +
        "and transcribed it, with no system yt-dlp/ffmpeg/Python installed by this app.",
      { segmentCount: outcome.segments.length }
    );
  } finally {
    await app.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[dm-smoke-test] FAILED:", err);
  process.exit(1);
});
