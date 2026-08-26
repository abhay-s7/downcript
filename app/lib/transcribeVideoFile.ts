import ffmpegPath from "ffmpeg-static";
import { TranscriptSegment } from "@/app/types";
import { execFileTracked } from "@/app/lib/process";
import { resolvePythonTool } from "@/app/lib/pythonRuntime";

export class NoAudioTrackError extends Error {}

// Normalizes a local video file's audio and runs it through Whisper. This is
// the exact sequence the Upload route has always used — extracted so a
// second source (Dailymotion, which downloads a full video file rather than
// simulating a browser upload) can call the identical, already-proven code
// instead of re-implementing ffmpeg/Whisper invocation a second time.
export async function transcribeVideoFile(
  videoPath: string,
  audioPath: string,
  jobId?: string
): Promise<TranscriptSegment[]> {
  try {
    await execFileTracked(jobId, ffmpegPath as string, [
      "-y",
      "-i", videoPath,
      "-ar", "16000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      audioPath,
    ]);
  } catch (err) {
    // Some public videos (short silent clips, b-roll, muted stock footage)
    // genuinely have no audio stream -- ffmpeg fails outright trying to map
    // one ("Output file does not contain any stream") rather than producing
    // empty audio. Surfaced as a specific, actionable error instead of a
    // generic "transcription failed" that looks like an app bug.
    const stderr = (err as { stderr?: string })?.stderr ?? "";
    if (/does not contain any stream/i.test(stderr)) {
      throw new NoAudioTrackError("This video has no audio track to transcribe.");
    }
    throw err;
  }

  const { command, args } = resolvePythonTool("transcribe", "scripts/transcribe.py");
  const { stdout } = await execFileTracked(jobId, command, [...args, audioPath], {
    maxBuffer: 1024 * 1024 * 50,
  });

  const raw = JSON.parse(stdout) as { text: string; start: number; duration: number }[];
  return raw.map((s) => ({ text: s.text, start: s.start, duration: s.duration }));
}
