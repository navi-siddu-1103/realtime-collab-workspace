"use client";
import { useCallback, useEffect, useState } from "react";

type C = {
  id: string; body: string; anchor: string | null; resolved: boolean;
  authorId: string; createdAt: string; author: { name: string };
};

export default function CommentsPanel({
  pageId, canComment, canResolve, currentUserId,
}: { pageId: string; canComment: boolean; canResolve: boolean; currentUserId: string }) {
  const [comments, setComments] = useState<C[]>([]);
  const [text, setText] = useState("");
  const [anchor, setAnchor] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}/comments`);
    if (res.ok) setComments((await res.json()).comments);
  }, [pageId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  function quoteSelection() {
    const sel = window.getSelection()?.toString().trim() ?? "";
    setAnchor(sel.slice(0, 300));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/pages/${pageId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, anchor }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed");
      return;
    }
    setText("");
    setAnchor("");
    load();
  }

  async function toggle(id: string) {
    await fetch(`/api/pages/${pageId}/comments/${id}`, { method: "PATCH" });
    load();
  }

  return (
    <aside className="space-y-3">
      <h2 className="text-lg font-semibold">Comments ({comments.length})</h2>

      {canComment ? (
        <form onSubmit={submit} className="space-y-2">
          {anchor && (
            <blockquote className="border-l-2 pl-2 text-sm text-gray-400">“{anchor}”</blockquote>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            required
            className="w-full rounded border bg-transparent p-2"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={quoteSelection}
              className="rounded border px-2 py-1 text-sm"
            >
              Quote selection
            </button>
            <button className="rounded bg-white px-3 py-1 text-sm text-black">Post</button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      ) : (
        <p className="text-sm text-gray-500">You have view-only access, so you can’t comment.</p>
      )}

      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className={`rounded border p-3 text-sm ${c.resolved ? "opacity-50" : ""}`}>
            {c.anchor && (
              <blockquote className="mb-1 border-l-2 pl-2 text-gray-400">“{c.anchor}”</blockquote>
            )}
            <div className="font-semibold">{c.author.name}</div>
            <p className="whitespace-pre-wrap">{c.body}</p>
            {(canResolve || c.authorId === currentUserId) && (
              <button onClick={() => toggle(c.id)} className="mt-1 text-xs underline">
                {c.resolved ? "Reopen" : "Resolve"}
              </button>
            )}
          </li>
        ))}
        {comments.length === 0 && <li className="text-sm text-gray-500">No comments yet.</li>}
      </ul>
    </aside>
  );
}