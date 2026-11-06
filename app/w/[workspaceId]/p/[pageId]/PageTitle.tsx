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
      setError((await res.json()).error ?? "Could not rename");
      setTitle(saved);
      return;
    }
    setSaved(next);
    setTitle(next);
    setError("");
    router.refresh();
  }

  if (!canEdit) return <h1 className="text-2xl font-bold">{initial}</h1>;

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        maxLength={120}
        aria-label="Page title"
        className="-mx-1 w-full rounded bg-transparent px-1 text-2xl font-bold outline-none hover:bg-white/5 focus:bg-white/10"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}