# Strattegys Command Central

Multi-agent web platform for business operations. Each agent has a specialized role and operates through a unified chat interface with contextual side panels.

## Agents

| Agent | Role | LLM |
|-------|------|-----|
| **Tim** | Business development, LinkedIn outreach, CRM | Gemini 2.5 Flash |
| **Suzi** | Personal assistant, reminders, scheduling | Gemini 2.5 Flash |
| **Friday** | Agent architect, workflow management | Gemini 2.5 Pro |
| **Scout** | Research, web search, market intelligence | Gemini 2.5 Flash |
| **Rainbow** | Child-friendly AI companion | Gemini (via Python server) |

## Architecture

```
Next.js (port 3001)          <- Command Central web UI (sole interface)
  |-- Chat with all agents
  |-- Kanban workflow boards
  |-- Reminders panel
  |-- Notification system

Twenty CRM (port 3000)       <- Contact/company/workflow data (Docker)
RainbowBot (port 18792)      <- Standalone Python server (systemd)
Nginx                        <- TLS termination, reverse proxy
```

**Server**: DigitalOcean droplet at `137.184.187.233`
**Domain**: `stratt-central.b2bcontentartist.com`
**Process manager**: PM2 (`command-central`)

## Directory Structure

```
agents/               <- System prompts (one folder per agent)
web/                  <- Next.js app (the main project)
  app/                <- Pages and API routes
  components/         <- React components
  lib/                <- Agent config, tools, cron, heartbeat
  public/             <- Static assets, avatars, sounds
tools/                <- Server-side CRM/LinkedIn shell scripts
scripts/              <- Deployment scripts
  deploy-web.sh       <- Manual fallback deploy
docs/                 <- Historical migration docs
docker-compose.yml    <- Production stack (Caddy + Next.js)
docker-compose.dev.yml <- Local dev stack (Docker)
Caddyfile             <- Reverse proxy config
```

## Deployment

```bash
# One-command deploy (validates locally, pushes, builds on server)
bash scripts/deploy-web.sh
```

Requires SSH agent setup:
```bash
# In Git Bash (one-time per session)
export SSH_AUTH_SOCK=/tmp/tim-agent.sock
ssh-add C:/Users/USER1/.ssh/hetzner_ed25519
```

Auto-deploys via GitHub Actions on push to `master` (web/ changes only).

## Local Development

**Recommended (Docker, matches production-style env and port 3001):**

```bash
cd COMMAND-CENTRAL   # repo root containing docker-compose.dev.yml
docker compose -f docker-compose.dev.yml up
```

Then open **http://localhost:3001** (hot reload via mounted `web/`). Uses `web/.env.local` and `host.docker.internal` for CRM DB — see comments in [`docker-compose.dev.yml`](docker-compose.dev.yml).

**Optional (Node on the host, same port as Docker):**

```bash
cd web
npm install
cp .env.local.example .env.local  # Fill in API keys
npm run dev                        # http://localhost:3001 (see package.json)
```

Do **not** run both Docker and `npm run dev` on **3001** at the same time — pick one.

## Key Integrations

- **Twenty CRM** -- Contact management, workflows, notes (PostgreSQL via Docker)
- **LinkedIn (Unipile)** -- Message sync, connection polling, inbound webhooks
- **Google Gemini** -- LLM for all agents
- **NextAuth** -- Authentication (credentials provider)
