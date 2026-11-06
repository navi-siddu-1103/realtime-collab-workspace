import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/dist/client/link";

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.member.findMany({
    where: { userId: session.user.id },
    include: { workspace: true },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hi, {session.user.name}</h1>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="rounded border px-3 py-1">Sign out</button>
        </form>
      </div>
      <ul className="space-y-2">
        {memberships.map((m) => (
          <li key={m.id} className="rounded border p-3">
            <Link href={`/w/${m.workspaceId}`} className="underline">{m.workspace.name}</Link>{" "}
            <span className="text-sm text-gray-500">({m.role})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}