import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pageId = new URL(req.url).searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { workspaceId: true },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.member.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: page.workspaceId } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = jwt.sign(
    { sub: session.user.id, name: session.user.name, pageId, role: member.role },
    process.env.WS_SECRET!,
    { expiresIn: "1h" }
  );
  return NextResponse.json({
    token,
    role: member.role,
    user: { id: session.user.id, name: session.user.name ?? "Anonymous" },
  });
}