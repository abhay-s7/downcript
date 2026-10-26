// Formats accepted by the Transcript tab's Upload flow (both the client
// picker in UploadInput.tsx and the server-side check in
// app/api/transcribe/route.ts import this same list, so the two can never
// drift apart). ffmpeg-static -- the bundled binary every transcription path
// already runs input through -- decodes all of these natively, so accepting
// audio alongside video needs no new dependency or engine change.
export const UPLOAD_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
export const UPLOAD_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wma"];
export const UPLOAD_ALLOWED_EXTENSIONS = [...UPLOAD_VIDEO_EXTENSIONS, ...UPLOAD_AUDIO_EXTENSIONS];

export function isAllowedUploadFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return false;
  return UPLOAD_ALLOWED_EXTENSIONS.includes(fileName.slice(dot).toLowerCase());
}
