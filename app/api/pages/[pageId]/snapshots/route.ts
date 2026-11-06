import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPageAccess } from "@/lib/page-access";

type Ctx = { params: Promise<{ pageId: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { pageId } = await params;
  const access = await getPageAccess(pageId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const snapshots = await prisma.snapshot.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
  return NextResponse.json({ snapshots });
}

const schema = z.object({ label: z.string().trim().max(100).optional() });

export async function POST(req: Request, { params }: Ctx) {
  const { pageId } = await params;
  const access = await getPageAccess(pageId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (access.role !== "OWNER" && access.role !== "EDITOR") {
    return NextResponse.json({ error: "Only editors can save versions" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ydocState: true },
  });
  if (!page?.ydocState) {
    return NextResponse.json({ error: "Nothing to snapshot yet" }, { status: 400 });
  }

  const snapshot = await prisma.snapshot.create({
    data: {
      pageId,
      createdById: access.userId,
      label: parsed.data.label || null,
      state: page.ydocState,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: snapshot.id }, { status: 201 });
}