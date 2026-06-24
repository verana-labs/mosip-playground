import { NextRequest, NextResponse } from "next/server";
import { takeIssued } from "../../../lib/issue-server";

export const dynamic = "force-dynamic";

// One-time read of the VC the callback stashed, keyed by the id in ?issued.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const vc = takeIssued(id);
  if (!vc) return NextResponse.json({ error: "not found or expired" }, { status: 404 });
  return NextResponse.json({ credential: vc });
}
