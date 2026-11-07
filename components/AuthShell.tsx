import Link from "next/link";

function Caret({ name, color }: { name: string; color: string }) {
  return (
    <span className="relative ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em]">
      <span className="caret-blink absolute inset-0" style={{ background: color }} />
      <span
        className="absolute -top-[1.45rem] left-[-1px] whitespace-nowrap rounded-md rounded-bl-none px-1.5 py-1 font-sans text-[11px] font-semibold leading-none text-black"
        style={{ background: color }}
      >
        {name}
      </span>
    </span>
  );
}

export default function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface p-12 lg:flex">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Collab
        </Link>
        <div className="max-w-xl space-y-5 font-serif text-[1.7rem] leading-[1.35]">
          <p className="font-semibold">Launch checklist</p>
          <p>
            Send the invite emails before Friday
            <Caret name="Asha" color="hsl(340 75% 65%)" />
          </p>
          <p>
            Move the design review to 3 pm
            <Caret name="Kiran" color="hsl(205 75% 62%)" />
          </p>
        </div>
        <p className="max-w-sm text-sm text-muted">
          Everyone edits the same page at once. Every cursor is visible and no change is lost.
        </p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-4xl">{title}</h1>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}