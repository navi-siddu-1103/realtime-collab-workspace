require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Y = require("yjs");
const jwt = require("jsonwebtoken");
const WebSocket = require("ws");
const { WebsocketProvider } = require("y-websocket");

const PAGE_ID = process.env.PAGE_ID;
if (!PAGE_ID) {
  console.error('Set PAGE_ID first, e.g. $env:PAGE_ID="cm..."');
  process.exit(1);
}
const OTHER_PAGE = process.env.OTHER_PAGE_ID || "some-other-page-id";
const PORT = process.env.WS_TEST_PORT || "1234";
const BASE = `ws://localhost:${PORT}`;
const SECRET = process.env.WS_SECRET;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sign({ role = "EDITOR", pageId = PAGE_ID, secret = SECRET, exp } = {}) {
  const payload = { sub: `sec-${role}`, name: `Sec ${role}`, pageId, role };
  payload.exp = exp ?? Math.floor(Date.now() / 1000) + 600;
  return jwt.sign(payload, secret);
}

function rawStatus(pathAndQuery) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${BASE}/${pathAndQuery}`);
    ws.on("open", () => { ws.close(); resolve("OPEN"); });
    ws.on("unexpected-response", (_req, res) => resolve(res.statusCode));
    ws.on("error", () => {});
    setTimeout(() => resolve("TIMEOUT"), 4000);
  });
}

function client(role) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(BASE, PAGE_ID, doc, {
    WebSocketPolyfill: WebSocket,
    params: { token: sign({ role }) },
    disableBc: true,
  });
  const synced = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${role} client did not sync`)), 8000);
    provider.on("sync", (s) => { if (s) { clearTimeout(t); resolve(); } });
  });
  return { doc, provider, text: doc.getText("sectest"), synced,
    close() { provider.destroy(); doc.destroy(); } };
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

async function main() {
  console.log(`Security test against ${BASE}, page ${PAGE_ID}\n`);

  // --- 1. Connection authentication ---
  const now = Math.floor(Date.now() / 1000);
  const cases = [
    ["No token is rejected", PAGE_ID, 401],
    ["Garbage token is rejected", `${PAGE_ID}?token=abc`, 401],
    ["Token signed with the wrong secret is rejected", `${PAGE_ID}?token=${sign({ secret: "wrong" })}`, 401],
    ["Expired token is rejected", `${PAGE_ID}?token=${sign({ exp: now - 60 })}`, 401],
    ["Token for another page is rejected", `${PAGE_ID}?token=${sign({ pageId: OTHER_PAGE })}`, 401],
    ["Valid token is accepted (control)", `${PAGE_ID}?token=${sign()}`, "OPEN"],
  ];
  for (const [name, p, expected] of cases) {
    const got = await rawStatus(p);
    check(name, got === expected, `got ${got}`);
  }

  // --- 2. Role enforcement ---
  const editor = client("EDITOR");
  await editor.synced;
  editor.text.insert(0, "EDITOR-WROTE-THIS ");
  await sleep(1000);

  const viewer = client("VIEWER");
  await viewer.synced;
  check("VIEWER can read edits made by an editor", viewer.text.toString().includes("EDITOR-WROTE-THIS"));

  const commenter = client("COMMENTER");
  await commenter.synced;

  viewer.text.insert(0, "VIEWER-HACK ");
  commenter.text.insert(0, "COMMENTER-HACK ");
  await sleep(2500);

  const editorSees = editor.text.toString();
  check("VIEWER write does not reach other clients", !editorSees.includes("VIEWER-HACK"));
  check("COMMENTER write does not reach other clients", !editorSees.includes("COMMENTER-HACK"));

  const reader = client("EDITOR");
  await reader.synced;
  const readerSees = reader.text.toString();
  check(
    "Rejected writes are not stored on the server (fresh client never sees them)",
    !readerSees.includes("VIEWER-HACK") && !readerSees.includes("COMMENTER-HACK")
  );

  editor.text.insert(0, "EDITOR-OK ");
  await sleep(1200);
  check("EDITOR write is still accepted (control)", reader.text.toString().includes("EDITOR-OK"));

  // --- cleanup ---
  editor.text.delete(0, editor.text.length);
  await sleep(1500);
  [editor, viewer, commenter, reader].forEach((c) => c.close());

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, "last-security-run.json"), JSON.stringify(results, null, 2));
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });