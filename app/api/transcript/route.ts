import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { TranscriptSegment } from "@/app/types";

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shortsMatch) {
        return shortsMatch[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Please provide a YouTube URL." }, { status: 400 });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json({ error: "Could not find a video ID in that URL." }, { status: 400 });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const segments: TranscriptSegment[] = transcript
      .map((line) => ({
        text: line.text.replace(/\s+/g, " ").trim(),
        start: line.offset / 1000,
        duration: line.duration / 1000,
      }))
      .filter((segment) => segment.text.length > 0);
    return NextResponse.json({ segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch transcript.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
