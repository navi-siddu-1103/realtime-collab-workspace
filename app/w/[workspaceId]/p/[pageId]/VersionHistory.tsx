"use client";
import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";

type Snap = { id: string; label: string | null; createdAt: string; createdBy: { name: string } };

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
      setMsg((await res.json()).error ?? "Failed");
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
    if (!confirm("Restore this version? The current content is saved as a snapshot first.")) return;
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
    <section className="space-y-3 border-t pt-4">
      <h2 className="text-lg font-semibold">Version history ({snaps.length})</h2>

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
            placeholder="Version name (optional)"
            className="flex-1 rounded border bg-transparent p-2"
          />
          <button className="rounded bg-white px-3 text-black">Save version</button>
        </form>
      )}
      {msg && <p className="text-sm text-red-500">{msg}</p>}

      <ul className="space-y-2">
        {snaps.map((s) => (
          <li key={s.id} className="rounded border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{s.label || "Untitled version"}</div>
                <div className="text-gray-500">
                  {s.createdBy.name} · {new Date(s.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => showPreview(s.id)} className="rounded border px-2 py-1">
                  Preview
                </button>
                {canEdit && (
                  <button onClick={() => restore(s.id)} className="rounded border px-2 py-1">
                    Restore
                  </button>
                )}
              </div>
            </div>
            {preview?.id === s.id && (
              <p className="mt-2 whitespace-pre-wrap rounded bg-white/5 p-2">{preview.text}</p>
            )}
          </li>
        ))}
        {snaps.length === 0 && <li className="text-sm text-gray-500">No versions saved yet.</li>}
      </ul>
    </section>
  );
}