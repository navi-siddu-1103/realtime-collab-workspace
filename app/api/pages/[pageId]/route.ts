import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPageAccess } from "@/lib/page-access";

const schema = z.object({ title: z.string().trim().min(1).max(120) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const access = await getPageAccess(pageId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (access.role !== "OWNER" && access.role !== "EDITOR") {
    return NextResponse.json({ error: "Only editors can rename pages" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid title" }, { status: 400 });

  const page = await prisma.page.update({
    where: { id: pageId },
    data: { title: parsed.data.title },
    select: { title: true },
  });
  return NextResponse.json({ title: page.title });
}