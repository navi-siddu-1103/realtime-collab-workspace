import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import Editor from "./Editor";
import PageTitle from "./PageTitle";

export default async function PageView({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}) {
  const { workspaceId, pageId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.member.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!member) notFound();

  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { id: true, title: true, workspace: { select: { name: true } } },
  });
  if (!page) notFound();

  const canEdit = member.role === "OWNER" || member.role === "EDITOR";
  const canComment = canEdit || member.role === "COMMENTER";

  return (
    <>
      <AppHeader user={{ id: session.user.id, name: session.user.name ?? "Account" }} />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-ink">Your workspaces</Link>
          <span aria-hidden>/</span>
          <Link href={`/w/${workspaceId}`} className="hover:text-ink">{page.workspace.name}</Link>
        </nav>
        <div className="mb-6 mt-4">
          <PageTitle pageId={page.id} initial={page.title} canEdit={canEdit} />
        </div>
        <Editor
          pageId={page.id}
          canComment={canComment}
          canResolve={canEdit}
          currentUserId={session.user.id}
        />
      </main>
    </>
  );
}