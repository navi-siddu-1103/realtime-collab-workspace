"use client";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import VersionHistory from "./VersionHistory";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 75% 65%)`;
}

type Me = { id: string; name: string; color: string };
type Peer = { clientId: number; name: string; color: string };

function Presence({ provider }: { provider: WebsocketProvider }) {
  const [peers, setPeers] = useState<Peer[]>([]);
  useEffect(() => {
    const aw = provider.awareness;
    const update = () => {
      const list: Peer[] = [];
      aw.getStates().forEach((s, clientId) => {
        if (s.user) list.push({ clientId, name: s.user.name, color: s.user.color });
      });
      setPeers(list);
    };
    update();
    aw.on("change", update);
    return () => aw.off("change", update);
  }, [provider]);

  return (
    <div className="flex -space-x-2">
      {peers.map((p) => (
        <div
          key={p.clientId}
          title={p.name}
          style={{ background: p.color }}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black text-sm font-semibold text-black"
        >
          {p.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
}

function Tiptap({
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
      attributes: { class: "min-h-[60vh] w-full rounded border p-4 outline-none" },
    },
  });
  return <EditorContent editor={editor} />;
}

export default function Editor({ pageId }: { pageId: string }) {
  const [session, setSession] = useState<{
    doc: Y.Doc; provider: WebsocketProvider; canEdit: boolean; me: Me;
  } | null>(null);

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

  if (!session) return <p className="text-gray-500">Connecting…</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Presence provider={session.provider} />
      </div>
      <Tiptap {...session} />
      <VersionHistory pageId={pageId} doc={session.doc} canEdit={session.canEdit} />
    </div>
  );
}