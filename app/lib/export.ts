import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { TranscriptSegment } from "@/app/types";

export interface ExportableVideo {
  title: string;
  segments: TranscriptSegment[];
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

const SENTENCE_END_RE = /[.!?…]["')\]]?$/;
const PARAGRAPH_PAUSE_SECONDS = 2.5;
const MIN_CHARS_FOR_SENTENCE_BREAK = 150;
const MAX_PARAGRAPH_CHARS = 500;

function joinFragments(current: string, next: string): string {
  if (!current) return next;
  return `${current} ${next}`
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Whisper segments are transcription chunks, not paragraphs: group them into
// readable paragraphs on pauses, sentence endings, or length, rather than
// treating every segment boundary as a paragraph break.
export function formatTranscriptAsParagraphs(segments: TranscriptSegment[]): string[] {
  const paragraphs: string[] = [];
  let current = "";
  let prevEnd = 0;

  for (const segment of segments) {
    const text = cleanText(segment.text);
    if (!text) continue;

    const gap = segment.start - prevEnd;
    const shouldBreak =
      current.length > 0 &&
      (gap > PARAGRAPH_PAUSE_SECONDS ||
        current.length > MAX_PARAGRAPH_CHARS ||
        (current.length > MIN_CHARS_FOR_SENTENCE_BREAK && SENTENCE_END_RE.test(current)));

    if (shouldBreak) {
      paragraphs.push(current);
      current = "";
    }

    current = joinFragments(current, text);
    prevEnd = segment.start + segment.duration;
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}

function paragraphBlocks(segments: TranscriptSegment[]): Paragraph[] {
  return formatTranscriptAsParagraphs(segments).map(
    (text) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 200 } })
  );
}

export async function buildSingleDocxBlob(
  title: string,
  segments: TranscriptSegment[]
): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: stripExtension(title), heading: HeadingLevel.HEADING_1 }),
          ...paragraphBlocks(segments),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

export async function buildCombinedDocxBlob(videos: ExportableVideo[]): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ text: "Google Drive Transcripts", heading: HeadingLevel.TITLE }),
  ];

  for (const video of videos) {
    children.push(
      new Paragraph({
        text: stripExtension(video.title),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400 },
      })
    );
    children.push(...paragraphBlocks(video.segments));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

export function buildTxt(title: string, segments: TranscriptSegment[]): string {
  const paragraphs = formatTranscriptAsParagraphs(segments);
  return `${stripExtension(title)}\n\n${paragraphs.join("\n\n")}\n`;
}

const TXT_DIVIDER = "=".repeat(40);

export function buildCombinedTxt(videos: ExportableVideo[]): string {
  const sections = videos.map((v) => {
    const paragraphs = formatTranscriptAsParagraphs(v.segments);
    return `${TXT_DIVIDER}\n${stripExtension(v.title)}\n${TXT_DIVIDER}\n\n${paragraphs.join("\n\n")}`;
  });
  return `${sections.join("\n\n\n")}\n`;
}

function srtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

function srtCue(index: number, start: number, end: number, text: string): string {
  return `${index}\n${srtTimestamp(start)} --> ${srtTimestamp(end)}\n${cleanText(text)}\n`;
}

export function buildSrt(segments: TranscriptSegment[]): string {
  let index = 1;
  const blocks = segments.map((s) => {
    const block = srtCue(index, s.start, s.start + Math.max(s.duration, 0.5), s.text);
    index += 1;
    return block;
  });
  return blocks.join("\n");
}

export function buildCombinedSrt(videos: ExportableVideo[]): string {
  let index = 1;
  let timeOffset = 0;
  const blocks: string[] = [];

  for (const video of videos) {
    blocks.push(srtCue(index, timeOffset, timeOffset + 2, video.title));
    index += 1;
    timeOffset += 3;

    let videoEnd = timeOffset;
    for (const seg of video.segments) {
      const start = timeOffset + seg.start;
      const end = start + Math.max(seg.duration, 0.5);
      blocks.push(srtCue(index, start, end, seg.text));
      index += 1;
      videoEnd = Math.max(videoEnd, end);
    }
    timeOffset = videoEnd + 3;
  }

  return blocks.join("\n");
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function triggerTextDownload(text: string, filename: string, mime: string) {
  triggerDownload(new Blob([text], { type: mime }), filename);
}
