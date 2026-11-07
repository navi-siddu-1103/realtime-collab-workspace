import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { colorFor } from "@/lib/colors";
import AppHeader from "@/components/AppHeader";
import InviteForm from "./InviteForm";
import { changeRole, removeMember } from "./actions";

const day = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

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
            include: { user: { select: { id: true, name: true, email: true } } },
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
  const isOwner = member.role === "OWNER";
  const pages = member.workspace.pages;

  return (
    <>
      <AppHeader user={{ id: userId, name: session.user.name ?? "Account" }} />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
          Your workspaces
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-serif text-4xl">{member.workspace.name}</h1>
          {canEdit && (
            <form action={createPage}>
              <button className="btn btn-primary">New page</button>
            </form>
          )}
        </div>

        <section aria-label="Pages" className="mt-8">
          {pages.length === 0 ? (
            <p className="border-y border-line py-10 text-muted">
              {canEdit
                ? "No pages yet. Create the first one to start writing."
                : "No pages yet. An editor needs to create one."}
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/w/${workspaceId}/p/${p.id}`}
                    className="-mx-2 flex items-baseline justify-between gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-ink/[0.04]"
                  >
                    <span className="font-serif text-xl">{p.title}</span>
                    <span className="shrink-0 text-sm text-muted">Edited {day.format(p.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isOwner && (
          <section aria-label="Members" className="mt-14">
            <h2 className="font-serif text-2xl">Members</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {member.workspace.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-black"
                      style={{ background: colorFor(m.user.id) }}
                    >
                      {m.user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{m.user.name}</div>
                      <div className="text-sm text-muted">{m.user.email}</div>
                    </div>
                  </div>

                  {m.role === "OWNER" ? (
                    <span className="text-sm text-muted">Owner</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <form action={changeRole.bind(null, workspaceId, m.id)} className="flex gap-2">
                        <select name="role" defaultValue={m.role} aria-label="Role" className="field w-auto">
                          <option value="EDITOR">Editor</option>
                          <option value="COMMENTER">Commenter</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <button className="btn">Save role</button>
                      </form>
                      <form action={removeMember.bind(null, workspaceId, m.id)}>
                        <button className="btn btn-danger">Remove</button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <InviteForm workspaceId={workspaceId} />
            </div>
          </section>
        )}
      </main>
    </>
  );
}