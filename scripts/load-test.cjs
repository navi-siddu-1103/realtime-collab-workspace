require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Y = require("yjs");
const jwt = require("jsonwebtoken");
const WebSocket = require("ws");
const { WebsocketProvider } = require("y-websocket");

const PAGE_ID = process.env.PAGE_ID;
if (!PAGE_ID) {
  console.error('Set PAGE_ID first, e.g. $env:PAGE_ID="cm..."');
  process.exit(1);
}
const CLIENTS = Number(process.env.CLIENTS || 10);
const DURATION = Number(process.env.DURATION || 20); // seconds of typing
const RATE = Number(process.env.RATE || 10); // edits per second per client
const PORTS = (process.env.PORTS || "1234").split(",");
const RUN = String(Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let source = "the quick brown fox jumps over the lazy dog ";
const sample = path.join(__dirname, "sample.txt");
if (fs.existsSync(sample)) source = fs.readFileSync(sample, "utf8").replace(/\s+/g, " ");

const latencies = [];
const clients = [];

for (let i = 0; i < CLIENTS; i++) {
  const doc = new Y.Doc();
  const token = jwt.sign(
    { sub: `load-${i}`, name: `Load ${i}`, pageId: PAGE_ID, role: "EDITOR" },
    process.env.WS_SECRET,
    { expiresIn: "10m" }
  );
  const provider = new WebsocketProvider(
    `ws://localhost:${PORTS[i % PORTS.length]}`,
    PAGE_ID,
    doc,
    { WebSocketPolyfill: WebSocket, params: { token }, disableBc: true }
  );
  const text = doc.getText("loadtest");
  const pings = doc.getMap("pings");

  // every edit carries a timestamp; receivers measure how long it took to arrive
  pings.observe((event, tr) => {
    if (tr.local) return;
    event.keysChanged.forEach((key) => {
      if (!key.startsWith(`${RUN}:`) || key === `${RUN}:${i}`) return;
      const v = pings.get(key);
      if (v && v.ts) latencies.push(Date.now() - v.ts);
    });
  });

  clients.push({ i, doc, provider, text, pings, sent: 0, offset: Math.floor(Math.random() * source.length) });
}

async function main() {
  console.log(`Connecting ${CLIENTS} clients to ports ${PORTS.join(", ")} ...`);
  await Promise.all(
    clients.map(
      (c) =>
        new Promise((resolve, reject) => {
          if (c.provider.synced) return resolve();
          const t = setTimeout(
            () => reject(new Error(`client ${c.i} did not sync (is a ws server running on that port?)`)),
            10000
          );
          c.provider.on("sync", (s) => {
            if (s) {
              clearTimeout(t);
              resolve();
            }
          });
        })
    )
  );
  console.log(`All connected. Typing for ${DURATION}s at ${RATE} edits/s per client ...`);

  const start = Date.now();
  const timers = clients.map((c) =>
    setInterval(() => {
      const chunk = source.substr(c.offset, 12);
      c.offset = (c.offset + 12) % Math.max(1, source.length - 12);
      const pos = Math.floor(Math.random() * (c.text.length + 1)); // random positions force real conflicts
      c.doc.transact(() => {
        c.text.insert(pos, chunk);
        c.pings.set(`${RUN}:${c.i}`, { ts: Date.now() });
      });
      c.sent++;
    }, 1000 / RATE)
  );

  await sleep(DURATION * 1000);
  timers.forEach(clearInterval);
  await sleep(3000); // let everything settle

  const hashes = clients.map((c) =>
    crypto.createHash("sha1").update(c.text.toString()).digest("hex")
  );
  const converged = new Set(hashes).size === 1;
  const totalSent = clients.reduce((n, c) => n + c.sent, 0);

  latencies.sort((a, b) => a - b);
  const pct = (p) =>
    latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] : NaN;

  const result = {
    clients: CLIENTS,
    servers: PORTS,
    durationSec: DURATION,
    editsPerSecPerClient: RATE,
    totalEditsSent: totalSent,
    editsPerSecTotal: +(totalSent / ((Date.now() - start) / 1000)).toFixed(1),
    finalDocumentChars: clients[0].text.length,
    latencySamples: latencies.length,
    latencyMs: { p50: pct(50), p95: pct(95), p99: pct(99), max: latencies[latencies.length - 1] ?? NaN },
    converged,
    distinctFinalStates: new Set(hashes).size,
  };
  console.log("\n=== LOAD TEST RESULT ===");
  console.log(JSON.stringify(result, null, 2));
  console.log(converged ? "\nPASS: all clients converged to identical content" : "\nFAIL: clients ended in different states");
  fs.writeFileSync(path.join(__dirname, "last-run.json"), JSON.stringify(result, null, 2));

  // clean up the test data we put into the page
  clients[0].doc.transact(() => {
    clients[0].text.delete(0, clients[0].text.length);
    clients[0].pings.clear();
  });
  await sleep(1500);
  clients.forEach((c) => {
    c.provider.destroy();
    c.doc.destroy();
  });
  process.exit(converged ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});