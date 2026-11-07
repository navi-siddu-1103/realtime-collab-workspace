import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";

const label = (r: string) => r.charAt(0) + r.slice(1).toLowerCase();
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.member.findMany({
    where: { userId: session.user.id },
    orderBy: { workspace: { createdAt: "asc" } },
    include: {
      workspace: { include: { _count: { select: { pages: true, members: true } } } },
    },
  });

  return (
    <>
      <AppHeader user={{ id: session.user.id, name: session.user.name ?? "Account" }} />
      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="font-serif text-4xl">Your workspaces</h1>
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link
                href={`/w/${m.workspaceId}`}
                className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-5 transition-colors hover:bg-ink/[0.04]"
              >
                <span>
                  <span className="block text-lg font-medium">{m.workspace.name}</span>
                  <span className="block text-sm text-muted">
                    {count(m.workspace._count.pages, "page")}, {count(m.workspace._count.members, "member")}
                  </span>
                </span>
                <span className="text-sm text-muted">{label(m.role)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}