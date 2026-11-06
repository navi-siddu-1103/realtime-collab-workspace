"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const ASSIGNABLE: Role[] = ["EDITOR", "COMMENTER", "VIEWER"];

async function requireOwner(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = await prisma.member.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!me || me.role !== "OWNER") throw new Error("Forbidden");
}

export async function inviteMember(
  workspaceId: string,
  _prev: { error?: string; ok?: string } | null,
  formData: FormData
): Promise<{ error?: string; ok?: string } | null> {
  await requireOwner(workspaceId);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) as Role;
  if (!ASSIGNABLE.includes(role)) return { error: "Choose a valid role." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "No account with that email. Ask them to sign up first." };

  const existing = await prisma.member.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (existing) return { error: `${user.name} is already a member.` };

  await prisma.member.create({ data: { userId: user.id, workspaceId, role } });
  revalidatePath(`/w/${workspaceId}`);
  return { ok: `${user.name} added as ${role}.` };
}

export async function changeRole(workspaceId: string, memberId: string, formData: FormData) {
  await requireOwner(workspaceId);
  const role = String(formData.get("role")) as Role;
  if (!ASSIGNABLE.includes(role)) return;
  await prisma.member.updateMany({
    where: { id: memberId, workspaceId, role: { not: "OWNER" } },
    data: { role },
  });
  revalidatePath(`/w/${workspaceId}`);
}

export async function removeMember(workspaceId: string, memberId: string) {
  await requireOwner(workspaceId);
  await prisma.member.deleteMany({
    where: { id: memberId, workspaceId, role: { not: "OWNER" } },
  });
  revalidatePath(`/w/${workspaceId}`);
}