import { NextRequest, NextResponse } from "next/server";
import { fetchMediaInfo, MediaInfoUnavailableError } from "@/app/lib/services/downloader/mediaInfo";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Please enter a URL." }, { status: 400 });
  }

  try {
    const info = await fetchMediaInfo(url);
    return NextResponse.json(info);
  } catch (err) {
    console.error("download-info failed:", err);
    const message =
      err instanceof MediaInfoUnavailableError
        ? "Unable to process this URL. Please check the link and try again."
        : "Unable to process this URL. Please check the link and try again.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
