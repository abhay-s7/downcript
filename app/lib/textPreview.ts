import { TranscriptSegment } from "@/app/types";

export function countWords(segments: TranscriptSegment[]): number {
  const text = segments.map((s) => s.text).join(" ").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export function formatWordCount(count: number): string {
  return `${count.toLocaleString()} word${count === 1 ? "" : "s"}`;
}

export function getPreviewText(paragraphs: string[], maxChars = 160): string {
  const text = paragraphs.join(" ");
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + "…";
}
