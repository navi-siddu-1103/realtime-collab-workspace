import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPageAccess } from "@/lib/page-access";


type Ctx = { params: Promise<{ pageId: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { pageId } = await params;
  const access = await getPageAccess(pageId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comments = await prisma.comment.findMany({
    where: { pageId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json({ comments });
}

const schema = z.object({
  body: z.string().trim().min(1).max(2000),
  anchor: z.string().max(300).optional(),
});

export async function POST(req: Request, { params }: Ctx) {
  const { pageId } = await params;
  const access = await getPageAccess(pageId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (access.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers cannot comment" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: {
      pageId,
      authorId: access.userId,
      body: parsed.data.body,
      anchor: parsed.data.anchor || null,
    },
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json({ comment }, { status: 201 });
}