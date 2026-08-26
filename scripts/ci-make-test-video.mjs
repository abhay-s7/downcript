// CI-only helper: generates a tiny, fully self-contained MP4 (no network
// asset dependency) using the project's own bundled ffmpeg-static binary, so
// the Windows CI smoke test has something real to feed into
// POST /api/transcribe without depending on third-party content staying
// available.
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";

const out = process.argv[2];
if (!out) {
  console.error("Usage: node scripts/ci-make-test-video.mjs <output.mp4>");
  process.exit(1);
}

execFileSync(
  ffmpegPath,
  [
    "-y",
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=16000:duration=3",
    "-f", "lavfi", "-i", "color=c=black:s=320x240:d=3",
    "-af", "volume=0.15",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    out,
  ],
  { stdio: "inherit" }
);

console.log(`[ci-make-test-video] wrote ${out}`);
