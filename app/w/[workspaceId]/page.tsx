import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { changeRole, removeMember } from "./actions";
import InviteForm from "./InviteForm";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const member = await prisma.member.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
        include: {
            workspace: {
                include: {
                pages: { orderBy: { updatedAt: "desc" } },
                members: {
                    orderBy: { id: "asc" },
                    include: { user: { select: { name: true, email: true } } },
                },
                },
            },
        },
    });
    if (!member) notFound();

    async function createPage() {
        "use server";
        const s = await auth();
        if (!s?.user?.id) redirect("/login");
        const m = await prisma.member.findUnique({
        where: { userId_workspaceId: { userId: s.user.id, workspaceId } },
        });
        if (!m || m.role === "VIEWER" || m.role === "COMMENTER") return;
        const page = await prisma.page.create({ data: { workspaceId } });
        redirect(`/w/${workspaceId}/p/${page.id}`);
    }

    const canEdit = member.role === "OWNER" || member.role === "EDITOR";

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Link href="/dashboard" className="text-sm underline">← Dashboard</Link>
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{member.workspace.name}</h1>
          {canEdit && (
            <form action={createPage}>
                <button className="rounded bg-white px-3 py-1 text-black">New page</button>
            </form>
          )}
      </div>
      <ul className="space-y-2">
          {member.workspace.pages.map((p) => (
          <li key={p.id} className="rounded border p-3">
              <Link href={`/w/${workspaceId}/p/${p.id}`}>{p.title}</Link>
          </li>
          ))}
          {member.workspace.pages.length === 0 && (
          <li className="text-gray-500">No pages yet.</li>
          )}
      </ul>

      {member.role === "OWNER" && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="text-lg font-semibold">Members</h2>
          <ul className="space-y-2">
            {member.workspace.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div>{m.user.name}</div>
                  <div className="text-sm text-gray-500">{m.user.email}</div>
                </div>
                {m.role === "OWNER" ? (
                  <span className="text-sm text-gray-500">OWNER</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <form action={changeRole.bind(null, workspaceId, m.id)} className="flex gap-2">
                      <select name="role" defaultValue={m.role} className="rounded border bg-black p-1">
                        <option value="EDITOR">EDITOR</option>
                        <option value="COMMENTER">COMMENTER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                      <button className="rounded border px-2 py-1 text-sm">Save</button>
                    </form>
                    <form action={removeMember.bind(null, workspaceId, m.id)}>
                      <button className="rounded border px-2 py-1 text-sm text-red-400">Remove</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <InviteForm workspaceId={workspaceId} />
        </section>
      )}
    </main>
  );
}