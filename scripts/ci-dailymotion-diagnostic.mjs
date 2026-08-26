// CI-only: reproduces the exact yt-dlp invocation app/lib/dailymotionDownload.ts
// uses (same resolver, same args, same spawn call), on a real Windows runner,
// so a genuine yt-dlp/exit-code/stderr can be captured instead of guessing
// from behavior reported on an end-user machine we don't have access to.
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const [, , url] = process.argv;
if (!url) {
  console.error("Usage: node scripts/ci-dailymotion-diagnostic.mjs <url>");
  process.exit(1);
}

function resolveYtDlp() {
  const name = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const dir = process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux";
  const candidate = path.join(process.cwd(), "vendor", "yt-dlp", dir, name);
  if (!existsSync(candidate)) throw new Error(`vendor yt-dlp not found at ${candidate}`);
  return candidate;
}

function run(label, exe, args) {
  return new Promise((resolve) => {
    console.log(`\n=== ${label} ===`);
    console.log(`exe: ${exe}`);
    console.log(`args: ${JSON.stringify(args)}`);
    const start = Date.now();
    const child = spawn(exe, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
      process.stdout.write(c);
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
      process.stderr.write(c);
    });
    child.once("error", (err) => {
      console.log(`[spawn error] ${err.message}`);
      resolve({ code: null, spawnError: err.message, stdout, stderr, ms: Date.now() - start });
    });
    child.once("exit", (code, signal) => {
      console.log(`[exit] code=${code} signal=${signal} elapsedMs=${Date.now() - start}`);
      resolve({ code, signal, stdout, stderr, ms: Date.now() - start });
    });
  });
}

async function main() {
  const ytDlp = resolveYtDlp();
  console.log(`resolved yt-dlp path: ${ytDlp}`);
  console.log(`exists: ${existsSync(ytDlp)}, size: ${existsSync(ytDlp) ? statSync(ytDlp).size : "n/a"}`);
  console.log(`ffmpeg-static path: ${ffmpegPath}`);
  console.log(`ffmpeg exists: ${existsSync(ffmpegPath)}`);

  const versionResult = await run("yt-dlp --version", ytDlp, ["--version"]);

  const dumpResult = await run("dump-json (metadata only)", ytDlp, [
    "--dump-json",
    "--no-warnings",
    url,
  ]);

  const videoPath = path.join(process.cwd(), "dm-diagnostic-video.mp4");
  const downloadArgs = [
    "-f", "worst[ext=mp4]/worst",
    "--concurrent-fragments", "8",
    "--ffmpeg-location", ffmpegPath,
    "--no-warnings",
    "--no-playlist",
    "--newline",
    "-o", videoPath,
    url.trim(),
  ];
  const downloadResult = await run("full download (exact app args)", ytDlp, downloadArgs);

  console.log("\n=== output file check ===");
  const exists = existsSync(videoPath);
  console.log(`videoPath: ${videoPath}`);
  console.log(`exists: ${exists}`);
  if (exists) {
    const { size } = statSync(videoPath);
    console.log(`size: ${size} bytes`);
  }

  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        version: { code: versionResult.code, stdout: versionResult.stdout.trim() },
        dumpJson: { code: dumpResult.code, stderrTail: dumpResult.stderr.slice(-1000) },
        download: {
          code: downloadResult.code,
          stderrTail: downloadResult.stderr.slice(-1500),
          outputFileExists: exists,
          outputFileSize: exists ? statSync(videoPath).size : 0,
        },
      },
      null,
      2
    )
  );

  const failed = versionResult.code !== 0 || dumpResult.code !== 0 || downloadResult.code !== 0 || !exists;
  if (failed) {
    console.error("\nDIAGNOSTIC RESULT: FAILURE (see SUMMARY above for which stage failed)");
    process.exit(1);
  }
  console.log("\nDIAGNOSTIC RESULT: SUCCESS — bundled Windows yt-dlp downloaded the Dailymotion video correctly.");
}

main().catch((err) => {
  console.error("diagnostic script crashed:", err);
  process.exit(1);
});
