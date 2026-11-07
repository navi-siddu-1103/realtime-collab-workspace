"use client";
import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";

type Snap = { id: string; label: string | null; createdAt: string; createdBy: { name: string } };

const when = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function VersionHistory({
  pageId, doc, canEdit,
}: { pageId: string; doc: Y.Doc; canEdit: boolean }) {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}/snapshots`);
    if (res.ok) setSnaps((await res.json()).snapshots);
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  async function save(l: string) {
    const res = await fetch(`/api/pages/${pageId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: l }),
    });
    if (!res.ok) {
      setMsg((await res.json()).error ?? "Could not save the version.");
      return false;
    }
    setMsg("");
    await load();
    return true;
  }

  async function fetchDoc(id: string) {
    const res = await fetch(`/api/pages/${pageId}/snapshots/${id}`);
    if (!res.ok) return null;
    const { state } = await res.json();
    const d = new Y.Doc();
    Y.applyUpdate(d, b64ToBytes(state));
    return d;
  }

  async function showPreview(id: string) {
    const d = await fetchDoc(id);
    if (!d) return;
    const text = d
      .getXmlFragment("default")
      .toString()
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    setPreview({ id, text: text || "(empty)" });
  }

  async function restore(id: string) {
    if (!confirm("Restore this version? The current content is saved as a version first.")) return;
    if (!(await save("Before restore"))) return;
    const d = await fetchDoc(id);
    if (!d) return;
    const src = d.getXmlFragment("default");
    const dst = doc.getXmlFragment("default");
    doc.transact(() => {
      dst.delete(0, dst.length);
      dst.insert(0, src.toArray().map((n) => n.clone() as Y.XmlElement | Y.XmlText));
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save(label)) setLabel("");
          }}
          className="flex gap-2"
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name this version (optional)"
            aria-label="Version name"
            className="field min-w-0 flex-1"
          />
          <button className="btn btn-primary btn-sm shrink-0">Save version</button>
        </form>
      )}
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}

      {snaps.length === 0 ? (
        <p className="text-sm text-muted">No versions yet. Save one before a big change so you can go back to it.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {snaps.map((s) => (
            <li key={s.id} className="py-3 text-sm">
              <div className="font-medium">{s.label || "Untitled version"}</div>
              <div className="text-xs text-muted">
                {s.createdBy.name}, {when.format(new Date(s.createdAt))}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => (preview?.id === s.id ? setPreview(null) : showPreview(s.id))}
                  className="btn btn-sm"
                >
                  {preview?.id === s.id ? "Hide preview" : "Preview"}
                </button>
                {canEdit && (
                  <button onClick={() => restore(s.id)} className="btn btn-sm">
                    Restore
                  </button>
                )}
              </div>
              {preview?.id === s.id && (
                <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-ink/[0.05] p-3 font-serif text-base">
                  {preview.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}