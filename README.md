# Real-Time Collaborative Workspace

A Notion/Figma-style workspace where several people edit the same document at once, see each other's cursors, and never lose changes. Built for the FS-02 internship project.

Demo video: _add link here_

## Features

- **Live co-editing** with a rich-text editor (TipTap) on top of Yjs, a CRDT, so concurrent edits merge without conflicts
- **Presence**: colored cursors with name labels and avatars of everyone online on the page
- **Accounts and workspaces**: email and password login, workspaces, pages, and member invites by email
- **Permissions**: OWNER, EDITOR, COMMENTER and VIEWER roles, enforced on the server and not only in the UI
- **Comments** with optional quoted text, resolve and reopen
- **Version history**: save named snapshots, preview an old version, restore it
- **Persistence**: documents are stored in PostgreSQL and survive server restarts
- **Horizontal scaling**: several WebSocket servers stay in sync through Redis pub/sub, and recover after a Redis outage

## Tech stack

| Layer | Technology |
|---|---|
| Frontend and API | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Editor | TipTap 2 with the Collaboration and CollaborationCursor extensions |
| CRDT and sync | Yjs, y-websocket, y-protocols |
| Realtime server | Node.js with `ws` (a separate process, `server/ws-server.cjs`) |
| Database | PostgreSQL 16 with Prisma |
| Scaling | Redis 7 (pub/sub) with ioredis |
| Auth | NextAuth (credentials provider, JWT sessions), bcryptjs, zod |

## Architecture

```mermaid
flowchart LR
  subgraph Client["Browser"]
    UI["Next.js pages<br/>TipTap editor"]
    Y["Yjs document<br/>y-websocket provider"]
  end
  subgraph Next["Next.js server"]
    AUTH["NextAuth"]
    API["API routes and<br/>server actions"]
  end
  subgraph WS["WebSocket tier"]
    A["ws-server A<br/>port 1234"]
    B["ws-server B<br/>port 1235"]
  end
  PG[("PostgreSQL")]
  R[("Redis pub/sub")]

  UI -->|HTTP| AUTH
  UI -->|HTTP| API
  API --> PG
  AUTH --> PG
  Y <-->|"WebSocket and signed token"| A
  Y <-->|"WebSocket and signed token"| B
  A <--> R
  B <--> R
  A -->|"load and save Yjs state"| PG
  B -->|"load and save Yjs state"| PG
```

The full design, sequence diagrams, data model and API reference are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started

### Prerequisites

- Node.js 20 or newer
- Docker Desktop (runs PostgreSQL and Redis)
- Git

### 1. Install

```bash
git clone https://github.com/navi-siddu-1103/realtime-collab-workspace.git
cd realtime-collab-workspace
npm install
```

### 2. Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env        # on Windows PowerShell: copy .env.example .env
```

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://collab:collab@localhost:5432/collab` |
| `AUTH_SECRET` | Signs NextAuth sessions | a random string of 32 or more characters |
| `WS_SECRET` | Signs the short-lived tokens the WebSocket server checks | a different random string |
| `NEXT_PUBLIC_WS_URL` | WebSocket address used by the browser | `ws://localhost:1234` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `WS_PORT` | Port of a WebSocket server (default `1234`) | `1235` for a second instance |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env`. It is already in `.gitignore`.

### 3. Start the databases

```bash
docker compose up -d
```

This starts PostgreSQL (user, password and database are all `collab`) and Redis. Data is kept in the `pgdata` Docker volume.

### 4. Create the database tables

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Run the app

Two processes are needed, each in its own terminal:

```bash
npm run dev     # Next.js on http://localhost:3000
npm run ws      # WebSocket server on port 1234
```

Open http://localhost:3000, sign up, and you land on your first workspace.

### 6. Try the collaboration

1. Create a page in your workspace and open it.
2. Open a second account in an incognito window. Sign it up, then invite it from the **Members** section of the workspace with the email address.
3. Open the same page in both windows and type. Text, cursors and avatars appear live.
4. Change the second user to VIEWER and reload: they can watch but not type.

### Running two WebSocket servers (Redis scaling)

```bash
npm run ws                              # server A on 1234
$env:WS_PORT=1235; npm run ws           # server B on 1235 (PowerShell)
# WS_PORT=1235 npm run ws               # same thing on macOS or Linux
```

To put two browsers on different servers while testing, add `?ws=1235` to the page URL in one of them. The server still checks the token, so this is only a testing aid.

## Roles

| | OWNER | EDITOR | COMMENTER | VIEWER |
|---|---|---|---|---|
| Read the page and live changes | Yes | Yes | Yes | Yes |
| Edit text | Yes | Yes | No | No |
| Post comments | Yes | Yes | Yes | No |
| Resolve comments | Any | Any | Own only | No |
| Save and restore versions | Yes | Yes | No | No |
| Create pages | Yes | Yes | No | No |
| Invite, change roles, remove members | Yes | No | No | No |

The WebSocket server reads the role from the signed token and drops edit messages from COMMENTER and VIEWER connections, so these limits hold even for a client that bypasses the UI.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run ws` | WebSocket server (uses `WS_PORT`, default 1234) |
| `npm run dev:all` | Runs the Next.js dev server and one WebSocket server together |
| `npm run loadtest` | Multi-client load and convergence test |
| `npm run securitytest` | WebSocket authentication and role-enforcement test |
| `npx prisma studio` | Browse the database in the browser |

## Testing

Both test scripts need the app's databases and WebSocket server(s) running. Create a page in the app, copy its ID from the URL (the part after `/p/`), then:

```bash
# PowerShell
$env:PAGE_ID="<page id>"
$env:PORTS="1234,1235"; $env:CLIENTS=10; $env:DURATION=20; $env:RATE=10
npm run loadtest
npm run securitytest
```

| Variable | Meaning | Default |
|---|---|---|
| `PAGE_ID` | Page to test against (use a throwaway page) | required |
| `PORTS` | Comma-separated WebSocket server ports; clients are spread across them | `1234` |
| `CLIENTS` | Simulated editors | `10` |
| `DURATION` | Seconds of typing | `20` |
| `RATE` | Edits per second per client | `10` |

The load test types real Project Gutenberg text at random positions and reports propagation latency percentiles and whether every client ended with identical content. To use real book text, download one to `scripts/sample.txt`:

```bash
curl -o scripts/sample.txt https://www.gutenberg.org/cache/epub/1342/pg1342.txt
```

Without that file the test falls back to a short repeated sentence.

### Results summary

| Test | Result |
|---|---|
| 10 clients, 2 servers, 20 s | 1,836 edits, all clients identical, latency p50 8 ms, p95 24 ms |
| 30 clients, 2 servers, heavy rate | 3,140 edits, all clients identical, latency p50 71 ms, p95 274 ms (single machine, saturated) |
| Redis outage | Servers diverge while Redis is down and reconcile automatically after it returns |
| Security test | 11 of 11 checks passed |

Details, method and limitations are in [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## Project structure

```
app/
  api/
    auth/[...nextauth]/    NextAuth route handler
    register/              Sign-up (creates user and first workspace)
    ws-token/              Issues the short-lived WebSocket token
    pages/[pageId]/
      comments/            List, create, resolve comments
      snapshots/           List, create, fetch version snapshots
  login/  signup/  dashboard/
  w/[workspaceId]/
    page.tsx               Page list and member management
    actions.ts             Server actions (invite, change role, remove)
    p/[pageId]/            Editor page, Editor, CommentsPanel, VersionHistory
auth.ts                    NextAuth configuration
lib/                       Prisma client and page-access helper
prisma/                    Schema and migrations
server/ws-server.cjs       WebSocket server (auth, roles, persistence, Redis)
scripts/                   Load test and security test
docker-compose.yml         PostgreSQL and Redis
docs/                      Architecture and test report
```

## Known limitations

- A role change takes effect on a user's next connection, not on a connection that is already open
- Pub/sub does not replay messages, so servers reconcile through a state-vector handshake after a Redis outage. Redis Streams would be sturdier
- Each server saves the whole document to PostgreSQL, so near-simultaneous saves from two servers are last-write-wins until they reconcile
- Comments refresh by polling every 3 seconds and quote text instead of being anchored to a position in the document
- Pages do not have editable titles yet, and invites only work for people who already have an account
- Load test numbers come from a single machine

## Next steps

- Editable page titles and a page tree
- Live comment updates over the existing socket instead of polling
- Email verification and rate limiting on sign-up and login
- Deployment of the WebSocket tier behind a load balancer
