import { NextRequest, NextResponse } from "next/server";
import {
  DriveFolderNotPublicError,
  extractFolderId,
  extractResourceKey,
  scanPublicFolder,
} from "@/app/lib/googleDrive";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Please enter a valid Google Drive folder link." },
      { status: 400 }
    );
  }

  const folderId = extractFolderId(url);
  if (!folderId) {
    return NextResponse.json(
      { error: "Please enter a valid Google Drive folder link." },
      { status: 400 }
    );
  }

  const resourceKey = extractResourceKey(url);

  try {
    const files = await scanPublicFolder(folderId, resourceKey);
    const mp4Files = files.filter((f) => f.name.toLowerCase().endsWith(".mp4"));

    if (mp4Files.length === 0) {
      return NextResponse.json(
        { error: "No MP4 videos were found in this folder." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, files: mp4Files });
  } catch (err) {
    if (err instanceof DriveFolderNotPublicError) {
      return NextResponse.json(
        { error: "This Google Drive folder is not publicly accessible." },
        { status: 403 }
      );
    }
    console.error("Google Drive folder scan failed:", err);
    return NextResponse.json(
      { error: "This Google Drive folder is not publicly accessible." },
      { status: 502 }
    );
  }
}
