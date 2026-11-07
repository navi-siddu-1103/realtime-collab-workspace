import Link from "next/link";
import { signOut } from "@/auth";
import { colorFor } from "@/lib/colors";

export default function AppHeader({ user }: { user: { id: string; name: string } }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight">
          Collab
        </Link>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-black"
            style={{ background: colorFor(user.id) }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}