import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPageAccess } from "@/lib/page-access";

export async function PATCH(
  _: Request,
  { params }: { params: Promise<{ pageId: string; commentId: string }> }
) {
  const { pageId, commentId } = await params;
  const access = await getPageAccess(pageId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comment = await prisma.comment.findFirst({ where: { id: commentId, pageId } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    access.role === "OWNER" || access.role === "EDITOR" || comment.authorId === access.userId;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { resolved: !comment.resolved },
  });
  return NextResponse.json({ resolved: updated.resolved });
}