require("dotenv").config();
const http = require("http");
const Y = require("yjs");
const jwt = require("jsonwebtoken");
const decoding = require("lib0/decoding");
const awarenessProtocol = require("y-protocols/awareness");
const Redis = require("ioredis");
const { WebSocketServer } = require("ws");
const { PrismaClient } = require("@prisma/client");
const { setupWSConnection, setPersistence } = require("y-websocket/bin/utils");

const prisma = new PrismaClient();
const timers = new Map();

// ---------- Redis pub/sub: relays updates between server instances ----------
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const pub = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);
pub.on("error", (e) => console.error("redis pub:", e.message));
sub.on("error", (e) => console.error("redis sub:", e.message));

const REMOTE = Symbol("redis"); // marks updates that came from Redis, so we never re-publish them
const live = new Map(); // docName -> ydoc currently loaded on THIS server

// Ask the other servers for whatever this server is missing
function requestSync(docName, ydoc) {
  pub.publish(`sv:${docName}`, Buffer.from(Y.encodeStateVector(ydoc))).catch(() => {});
}

sub.on("messageBuffer", (channelBuf, msg) => {
  const channel = channelBuf.toString();
  const i = channel.indexOf(":");
  const kind = channel.slice(0, i);
  const docName = channel.slice(i + 1);
  const ydoc = live.get(docName);
  if (!ydoc) return;
  const bytes = new Uint8Array(msg);

  if (kind === "doc") {
    console.log(`[redis] doc update for ${docName}`); // remove once your test evidence is captured
    Y.applyUpdate(ydoc, bytes, REMOTE);
  } else if (kind === "aw") {
    awarenessProtocol.applyAwarenessUpdate(ydoc.awareness, bytes, REMOTE);
  } else if (kind === "sv") {
    // another server says what it has: send back only what it is missing
    const diff = Y.encodeStateAsUpdate(ydoc, bytes);
    if (diff.length > 2) {
      console.log(`[redis] resync reply for ${docName} (${diff.length} bytes)`);
      pub.publish(`doc:${docName}`, Buffer.from(diff)).catch(() => {});
    }
  }
});

// After a Redis outage, ioredis reconnects and re-subscribes by itself;
// then we reconcile every page this server has open.
sub.on("ready", () => {
  live.forEach((ydoc, docName) => requestSync(docName, ydoc));
});

// ---------- Persistence ----------
async function save(docName, ydoc) {
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
  await prisma.page.updateMany({ where: { id: docName }, data: { ydocState: state } });
}

setPersistence({
  provider: null,
  bindState: async (docName, ydoc) => {
    const page = await prisma.page.findUnique({
      where: { id: docName },
      select: { ydocState: true },
    });
    if (page?.ydocState) Y.applyUpdate(ydoc, new Uint8Array(page.ydocState));

    live.set(docName, ydoc);
    sub
      .subscribe(`doc:${docName}`, `aw:${docName}`, `sv:${docName}`)
      .then(() => requestSync(docName, ydoc))
      .catch(() => {});

    ydoc.on("update", (update, origin) => {
      if (origin !== REMOTE) pub.publish(`doc:${docName}`, Buffer.from(update)).catch(() => {});
      clearTimeout(timers.get(docName));
      timers.set(docName, setTimeout(() => save(docName, ydoc).catch(console.error), 1000));
    });

    ydoc.awareness.on("update", ({ added, updated, removed }, origin) => {
      if (origin === REMOTE) return;
      const changed = added.concat(updated, removed);
      const msg = awarenessProtocol.encodeAwarenessUpdate(ydoc.awareness, changed);
      pub.publish(`aw:${docName}`, Buffer.from(msg)).catch(() => {});
    });
  },
  writeState: async (docName, ydoc) => {
    clearTimeout(timers.get(docName));
    await save(docName, ydoc);
    live.delete(docName);
    sub.unsubscribe(`doc:${docName}`, `aw:${docName}`, `sv:${docName}`).catch(() => {});
  },
});

// ---------- Read-only enforcement for VIEWER / COMMENTER ----------
// message type 0 = sync; inside it, subtype 1 (step2) and 2 (update) carry edits
function isWriteMessage(data) {
  try {
    const d = decoding.createDecoder(new Uint8Array(data));
    if (decoding.readVarUint(d) !== 0) return false;
    const subType = decoding.readVarUint(d);
    return subType === 1 || subType === 2;
  } catch {
    return true;
  }
}

// ---------- Server ----------
const port = process.env.WS_PORT || 1234;
const wss = new WebSocketServer({ noServer: true });
const server = http.createServer((_, res) => res.end("y-websocket up"));

wss.on("connection", (conn, req, claims) => {
  const canWrite = claims.role === "OWNER" || claims.role === "EDITOR";
  if (!canWrite) {
    const origOn = conn.on.bind(conn);
    conn.on = (event, fn) =>
      event === "message"
        ? origOn(event, (data, ...rest) => {
            if (!isWriteMessage(data)) fn(data, ...rest);
          })
        : origOn(event, fn);
  }
  setupWSConnection(conn, req);
});

server.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const docName = url.pathname.slice(1);
    const claims = jwt.verify(url.searchParams.get("token") || "", process.env.WS_SECRET);
    if (claims.pageId !== docName) throw new Error("page mismatch");
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, claims));
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

server.listen(port, () => console.log(`y-websocket listening on ${port}`));