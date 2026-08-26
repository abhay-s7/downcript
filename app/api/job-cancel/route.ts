import { NextRequest, NextResponse } from "next/server";
import { killJob } from "@/app/lib/jobRegistry";

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();

  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "A job ID is required." }, { status: 400 });
  }

  const killed = killJob(jobId);
  return NextResponse.json({ success: true, killed });
}
