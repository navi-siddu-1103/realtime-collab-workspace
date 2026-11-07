"use client";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useEditor, EditorContent, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { colorFor } from "@/lib/colors";
import CommentsPanel from "./CommentsPanel";
import VersionHistory from "./VersionHistory";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

type Me = { id: string; name: string; color: string };
type Peer = { id: string; name: string; color: string };
type Status = "connecting" | "connected" | "disconnected";

function Presence({ provider, meId }: { provider: WebsocketProvider; meId: string }) {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const aw = provider.awareness;
    const update = () => {
      const seen = new Map<string, Peer>();
      aw.getStates().forEach((s) => {
        const u = s.user;
        if (u?.id && !seen.has(u.id)) seen.set(u.id, { id: u.id, name: u.name, color: u.color });
      });
      setPeers([...seen.values()]);
    };
    update();
    aw.on("change", update);
    return () => aw.off("change", update);
  }, [provider]);

  const shown = peers.slice(0, 5);
  const extra = peers.length - shown.length;

  return (
    <div className="flex items-center" aria-label={`${peers.length} online`}>
      {shown.map((p) => (
        <span
          key={p.id}
          title={p.id === meId ? `${p.name} (you)` : p.name}
          className="-ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-surface text-xs font-semibold text-black first:ml-0"
          style={{ background: p.color }}
        >
          {p.name.charAt(0).toUpperCase()}
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-2 grid h-8 min-w-8 place-items-center rounded-full border-2 border-surface bg-line px-1 text-xs font-semibold">
          +{extra}
        </span>
      )}
    </div>
  );
}

function ToolbarButton({
  label, onClick, active, children,
}: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm transition-colors ${
        active ? "bg-ink text-paper" : "hover:bg-ink/[0.07]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}

function Toolbar({ editor }: { editor: TipTapEditor }) {
  const run = () => editor.chain().focus();
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-3 z-10 flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface p-1"
    >
      <ToolbarButton label="Undo" onClick={() => run().undo().run()}>Undo</ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => run().redo().run()}>Redo</ToolbarButton>
      <Divider />
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => run().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => run().toggleItalic().run()}>
        <span className="font-serif italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => run().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>
      <Divider />
      <ToolbarButton label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => run().toggleHeading({ level: 1 }).run()}>
        H1
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => run().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolbarButton>
      <Divider />
      <ToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => run().toggleBulletList().run()}>
        Bullets
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => run().toggleOrderedList().run()}>
        Numbers
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => run().toggleBlockquote().run()}>
        Quote
      </ToolbarButton>
      <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => run().toggleCodeBlock().run()}>
        Code
      </ToolbarButton>
    </div>
  );
}

function DocEditor({
  doc, provider, canEdit, me,
}: { doc: Y.Doc; provider: WebsocketProvider; canEdit: boolean; me: Me }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: doc }),
      CollaborationCursor.configure({ provider, user: me }),
    ],
    editorProps: {
      attributes: { class: "doc-body min-h-[60vh] outline-none", "aria-label": "Page content" },
    },
  });

  return (
    <div className="space-y-3">
      {canEdit && editor && <Toolbar editor={editor} />}
      <div className="rounded-xl border border-line bg-surface px-6 py-8 sm:px-12 sm:py-12">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default function Editor({
  pageId, canComment, canResolve, currentUserId,
}: { pageId: string; canComment: boolean; canResolve: boolean; currentUserId: string }) {
  const [session, setSession] = useState<{
    doc: Y.Doc; provider: WebsocketProvider; canEdit: boolean; me: Me;
  } | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [tab, setTab] = useState<"comments" | "history">("comments");

  useEffect(() => {
    let cancelled = false;
    let doc: Y.Doc | null = null;
    let provider: WebsocketProvider | null = null;

    (async () => {
      const res = await fetch(`/api/ws-token?pageId=${pageId}`);
      if (!res.ok) return;
      const { token, role, user } = await res.json();
      if (cancelled) return;
      doc = new Y.Doc();
      const port = new URLSearchParams(window.location.search).get("ws");
      const url = port ? `ws://localhost:${port}` : WS_URL;
      provider = new WebsocketProvider(url, pageId, doc, { params: { token } });
      provider.on("status", ({ status }: { status: Status }) => setStatus(status));
      setSession({
        doc,
        provider,
        canEdit: role === "OWNER" || role === "EDITOR",
        me: { id: user.id, name: user.name, color: colorFor(user.id) },
      });
    })();

    return () => {
      cancelled = true;
      provider?.destroy();
      doc?.destroy();
      setSession(null);
    };
  }, [pageId]);

  if (!session) return <p className="text-muted">Connecting…</p>;

  const statusLabel =
    status === "connected" ? "Live" : status === "connecting" ? "Connecting…" : "Offline, trying to reconnect…";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-ok" : "bg-muted"}`} />
            {statusLabel}
          </p>
          <Presence provider={session.provider} meId={session.me.id} />
        </div>

        {!session.canEdit && (
          <p className="rounded-lg border border-line px-3 py-2 text-sm text-muted">
            {canComment
              ? "You can read and comment on this page."
              : "You have view-only access to this page."}
          </p>
        )}

        <DocEditor {...session} />
      </div>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
          {(["comments", "history"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t === "comments" ? "Comments" : "Version history"}
            </button>
          ))}
        </div>

        {tab === "comments" ? (
          <CommentsPanel
            pageId={pageId}
            canComment={canComment}
            canResolve={canResolve}
            currentUserId={currentUserId}
          />
        ) : (
          <VersionHistory pageId={pageId} doc={session.doc} canEdit={session.canEdit} />
        )}
      </aside>
    </div>
  );
}