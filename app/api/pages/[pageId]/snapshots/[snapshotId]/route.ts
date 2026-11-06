import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPageAccess } from "@/lib/page-access";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ pageId: string; snapshotId: string }> }
) {
  const { pageId, snapshotId } = await params;
  const access = await getPageAccess(pageId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const snap = await prisma.snapshot.findFirst({ where: { id: snapshotId, pageId } });
  if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ state: Buffer.from(snap.state).toString("base64") });
}