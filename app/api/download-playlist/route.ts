import { NextRequest, NextResponse } from "next/server";
import { expandPlaylist } from "@/app/lib/services/downloader/mediaInfo";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Please enter a URL." }, { status: 400 });
  }

  try {
    const urls = await expandPlaylist(url);
    return NextResponse.json({ urls });
  } catch (err) {
    console.error("download-playlist failed:", err);
    return NextResponse.json({ error: "Unable to expand this playlist." }, { status: 422 });
  }
}
