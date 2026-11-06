import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Editor from "./Editor";
import CommentsPanel from "./CommentsPanel";

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
    select: { id: true, title: true },
  });
  if (!page) notFound();

  const canEdit = member.role === "OWNER" || member.role === "EDITOR";
  const canComment = canEdit || member.role === "COMMENTER";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <Link href={`/w/${workspaceId}`} className="text-sm underline">← {`Back`}</Link>
      <h1 className="text-2xl font-bold">{page.title}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Editor pageId={page.id} />
        <CommentsPanel
          pageId={page.id}
          canComment={canComment}
          canResolve={canEdit}
          currentUserId={session.user.id}
        />
      </div>
    </main>
  );
}