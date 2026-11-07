"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PageTitle({
  pageId, initial, canEdit,
}: { pageId: string; initial: string; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState("");

  async function save() {
    const next = title.trim();
    if (!canEdit || next === saved) return;
    if (!next) { setTitle(saved); return; }
    const res = await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not rename the page.");
      setTitle(saved);
      return;
    }
    setSaved(next);
    setTitle(next);
    setError("");
    router.refresh();
  }

  if (!canEdit) return <h1 className="font-serif text-4xl">{initial}</h1>;

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        maxLength={120}
        aria-label="Page title"
        className="-mx-2 w-full rounded-lg bg-transparent px-2 font-serif text-4xl outline-none hover:bg-ink/[0.04] focus:bg-ink/[0.06]"
      />
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}