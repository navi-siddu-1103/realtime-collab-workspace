require("dotenv").config();
const http = require("http");
const Y = require("yjs");
const jwt = require("jsonwebtoken");
const decoding = require("lib0/decoding");
const { WebSocketServer } = require("ws");
const { PrismaClient } = require("@prisma/client");
const { setupWSConnection, setPersistence } = require("y-websocket/bin/utils");

const prisma = new PrismaClient();
const timers = new Map();

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
    ydoc.on("update", () => {
      clearTimeout(timers.get(docName));
      timers.set(docName, setTimeout(() => save(docName, ydoc).catch(console.error), 1000));
    });
  },
  writeState: async (docName, ydoc) => {
    clearTimeout(timers.get(docName));
    await save(docName, ydoc);
  },
});

// message type 0 = sync; inside it, subtype 1 (step2) and 2 (update) carry edits
function isWriteMessage(data) {
  try {
    const d = decoding.createDecoder(new Uint8Array(data));
    if (decoding.readVarUint(d) !== 0) return false;
    const sub = decoding.readVarUint(d);
    return sub === 1 || sub === 2;
  } catch {
    return true;
  }
}

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