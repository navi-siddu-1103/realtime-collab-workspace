"use client";
import { useCallback, useEffect, useState } from "react";
import { colorFor } from "@/lib/colors";

type C = {
  id: string; body: string; anchor: string | null; resolved: boolean;
  authorId: string; createdAt: string; author: { name: string };
};

const when = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

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
    if (!sel) {
      setError("Select some text in the page first.");
      return;
    }
    setError("");
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
      setError((await res.json()).error ?? "Could not post the comment.");
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
    <div className="space-y-5">
      {canComment ? (
        <form onSubmit={submit} className="space-y-2">
          {anchor && (
            <blockquote className="border-l-2 border-line pl-3 text-sm italic text-muted">“{anchor}”</blockquote>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment"
            aria-label="Comment"
            rows={3}
            className="field resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={quoteSelection} className="btn btn-sm">
              Quote selected text
            </button>
            <button disabled={!text.trim()} className="btn btn-primary btn-sm">
              Post comment
            </button>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
      ) : (
        <p className="text-sm text-muted">You have view-only access, so you can read comments but not add them.</p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted">
          No comments yet. Select text in the page, quote it, and start the conversation.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {comments.map((c) => (
            <li key={c.id} className={`py-3 text-sm ${c.resolved ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold text-black"
                  style={{ background: colorFor(c.authorId) }}
                >
                  {c.author.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium">{c.author.name}</span>
                <span className="text-xs text-muted">{when.format(new Date(c.createdAt))}</span>
              </div>
              {c.anchor && (
                <blockquote className="mt-2 border-l-2 border-line pl-3 italic text-muted">“{c.anchor}”</blockquote>
              )}
              <p className="mt-1.5 whitespace-pre-wrap">{c.body}</p>
              <div className="mt-1.5 flex items-center gap-3 text-xs">
                {c.resolved && <span className="text-ok">Resolved</span>}
                {(canResolve || c.authorId === currentUserId) && (
                  <button onClick={() => toggle(c.id)} className="text-muted underline underline-offset-4 hover:text-ink">
                    {c.resolved ? "Reopen" : "Resolve"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}