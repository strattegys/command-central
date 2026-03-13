# Agent Tim Architecture

Technical architecture documentation for Agent Tim running on Nanobot framework.

## System Overview

Nanobot is an MCP-native AI agent framework that provides a lightweight gateway for AI assistants with multi-channel messaging support. Unlike container-based frameworks, Nanobot runs as a single Python process with custom tool integration.

## Component Architecture

### 1. Nanobot Gateway (Python)

**Location**: `/root/.local/bin/nanobot`

**Responsibilities**:
- Message orchestration and routing
- Channel management (Telegram)
- Agent loop and session management
- LLM provider integration (Gemini, Groq)
- Tool execution (bash scripts)
- Conversation persistence

**Key Files**:
- `/root/.nanobot/config.json` - Configuration
- `/root/.nanobot/system-prompt.md` - Agent personality and instructions
- `/root/.nanobot/tools/` - Custom tool scripts
- `/root/.nanobot/sessions/` - Conversation sessions

### 2. Telegram Channel Handler

**Configuration**: `/root/.nanobot/config.json`

**Telegram Integration**:
- Connects to Telegram Bot API (@timx509_bot)
- Receives messages via long polling
- Sends responses back to Telegram
- Configured in `channels.telegram` section
- Supports user allowlist (currently set to `["*"]` for all users)

**Channel Features**:
- Real-time message processing
- Typing indicators
- Media support
- No trigger required for main chat

### 3. LLM Provider Integration

**Primary Model**: Gemini 2.5 Flash (Google AI)

**Configuration**: `/root/.nanobot/config.json`

**Provider Setup**:
```json
{
  "providers": {
    "groq": { "apiKey": "..." },
    "gemini": { "apiKey": "..." }
  },
  "agents": {
    "defaults": {
      "model": "gemini/gemini-2.5-flash",
      "maxTokens": 4096,
      "temperature": 0.7,
      "maxToolIterations": 20,
      "memoryWindow": 50
    }
  }
}
```

**Features**:
- Fast response times (2-5 seconds)
- Free tier (1500 requests/day)
- Configurable model switching
- Support for 20+ LLM providers

### 4. Custom Tools

**Location**: `/root/.nanobot/tools/`

**Available Tools**:

**LinkedIn Integration** (`linkedin.sh`):
- Profile lookup via ConnectSafely API
- Send messages (requires confirmation)
- Send connection requests (requires confirmation)
- Rate limits: 120 profiles/day, 100 messages/day, 90 connections/week

**Twenty CRM Integration** (`twenty_crm.sh`):
- Full CRUD access to all CRM objects
- Contacts, Companies, Opportunities, Tasks, Notes
- Calendar Events, Messages, Activities
- Attachments, Favorites, Workflows
- Delete operations require user confirmation

**Web Search** (built-in):
- Brave Search API integration
- Configured in `tools.web.search`
- Max 5 results per query

**Summarization** (CLI tool):
- Content extraction from URLs, videos, PDFs
- Uses Gemini 2.0 Flash Exp model
- Supports multiple output lengths

### 5. Twenty CRM Integration

**CRM Instance**: https://stratt-central.b2bcontentartist.com

**API Access**: 
- REST API at `http://localhost:3000/rest/`
- GraphQL API at `http://localhost:3000/graphql/`
- Bearer token authentication
- API key stored in `/root/.nanobot/tools/twenty_crm.sh`

**Available Operations**:
- **Contacts**: list, search, get, create, update, delete
- **Companies**: list, search, get, create, update, delete
- **Opportunities**: list, search, get, create, update, delete
- **Tasks**: list, search, get, create, update, delete
- **Notes**: list, get, create, update, delete
- **Calendar Events**: list, get, create, update, delete
- **Messages & Threads**: list, get, create
- **Activities**: list, get, create
- **Other**: attachments, favorites, workflows, workspace members

### 6. Session Management

**Location**: `/root/.nanobot/sessions/`

**Session Storage**:
- Conversation history per channel
- Session persistence across restarts
- Memory window: 50 messages (configurable)
- Session data stored in JSON format

**Configuration**:
```json
{
  "agents": {
    "defaults": {
      "memoryWindow": 50,
      "maxToolIterations": 20
    }
  }
}
```

### 7. File System Structure

```
/root/.nanobot/
├── config.json                  # Main configuration
├── system-prompt.md             # Agent personality and instructions
├── tools/
│   ├── linkedin.sh              # LinkedIn integration
│   ├── twenty_crm.sh            # Twenty CRM integration
│   └── [custom tools]           # Additional bash tools
├── sessions/                    # Conversation sessions
├── media/                       # Media files
├── cron/                        # Scheduled tasks
└── workspace/                   # Agent workspace

/mnt/gdrive/                     # Google Drive mount
├── backups/
│   └── twenty-crm/              # CRM database backups
└── [workspace files]            # Agent-created files

/etc/systemd/system/
└── nanobot.service              # Systemd service definition
```

## Message Flow

### Inbound Message (Telegram → Agent)

```
1. Telegram Bot API
   ↓ (long polling)
2. Nanobot Gateway (Telegram Channel)
   ↓ (process message)
3. Agent Loop
   ↓ (load session)
4. System Prompt + Message Context
   ↓ (prepare query)
5. LLM Provider (Gemini 2.5 Flash)
   ↓ (generate response with tool calls)
6. Tool Execution (bash scripts)
   ↓ (execute if needed)
7. Response Generation
   ↓ (format response)
8. Nanobot Gateway
   ↓ (send to Telegram)
9. Telegram Bot API
   ↓
10. User receives message
```

### Tool Execution Flow

```
┌─────────────────────────────────────┐
│  Nanobot Gateway                    │
│                                     │
│  1. Receive message                 │
│  2. Load session history            │
│  3. Prepare context + system prompt │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  LLM Provider (Gemini)              │
│                                     │
│  1. Process query with context      │
│  2. Determine if tools needed       │
│  3. Generate tool calls             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Tool Execution                     │
│                                     │
│  1. Execute bash script             │
│  2. Capture output                  │
│  3. Return results to LLM           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Response Generation                │
│                                     │
│  1. LLM processes tool results      │
│  2. Generate final response         │
│  3. Save to session                 │
│  4. Send to Telegram                │
└─────────────────────────────────────┘
```

## Security Model

### Tool Sandboxing

**Bash Script Execution**:
- Tools run as bash scripts in `/root/.nanobot/tools/`
- No direct LLM access to API keys
- API keys embedded in tool scripts (not exposed to model)
- Tool output sanitized before returning to LLM

**CRM Access Control**:
- Delete operations require explicit user confirmation
- Data validation before create/update operations
- CRM data restricted to private chat only
- No CRM access in group chats

**LinkedIn Integration**:
- Message/connection requests require confirmation
- Rate limiting enforced by API
- Profile lookups don't require confirmation

### Credential Security

**API Key Protection**:
- Gemini API key in `/root/.nanobot/config.json`
- Groq API key in `/root/.nanobot/config.json`
- Twenty CRM API key in `/root/.nanobot/tools/twenty_crm.sh`
- LinkedIn API keys in `/root/.nanobot/tools/linkedin.sh`
- Keys never exposed to LLM context

**Token Security**:
- Telegram bot token in config.json
- Config file readable only by root
- No token exposure in logs or responses

### Workspace Security

**Google Drive Mount**:
- Mounted at `/mnt/gdrive`
- Agent workspace configured to use gdrive
- Automatic backups stored in `/mnt/gdrive/backups/`
- Read/write access for agent operations

## Performance Characteristics

### Resource Usage

**Nanobot Gateway**:
- Memory: ~140 MB (peak: 141 MB)
- CPU: Low to medium (depends on LLM calls)
- Disk I/O: Minimal (session storage)

**Twenty CRM**:
- Memory: ~1.4 GB (Docker containers)
- CPU: Low (idle), medium (during queries)
- Disk I/O: Moderate (PostgreSQL operations)

**Current Droplet (8GB RAM)**:
- Total memory used: ~1.4 GB
- Available memory: ~6.4 GB
- Plenty of headroom for concurrent operations

### Latency

**Message Processing**:
- Telegram receive: <1 second
- Session load: <100ms
- Gemini API: 1-3 seconds (fast model)
- Tool execution: 0.5-2 seconds (varies by tool)
- Response send: <1 second

**Total Response Time**:
- Simple queries: 2-5 seconds
- With tool calls: 3-8 seconds
- Complex multi-tool: 5-15 seconds

### Scalability

**Concurrent Conversations**:
- Single-threaded Python process
- Handles multiple Telegram users
- Session-based conversation tracking
- No container overhead

**Message Processing**:
- Asynchronous message handling
- Session persistence across restarts
- Memory window: 50 messages per conversation

## Configuration

### Configuration File

**Location**: `/root/.nanobot/config.json`

**Structure**:
```json
{
  "providers": {
    "groq": { "apiKey": "..." },
    "gemini": { "apiKey": "..." }
  },
  "agents": {
    "defaults": {
      "model": "gemini/gemini-2.5-flash",
      "maxTokens": 4096,
      "temperature": 0.7,
      "maxToolIterations": 20,
      "memoryWindow": 50,
      "workspace": "/mnt/gdrive"
    }
  },
  "tools": {
    "web": {
      "search": {
        "apiKey": "...",
        "maxResults": 5
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "...",
      "allowFrom": ["*"]
    }
  }
}
```

### System Prompt

**Location**: `/root/.nanobot/system-prompt.md`

**Contains**:
- Agent personality (Tim)
- Role-based access control
- Writing style guidelines
- Tool usage instructions
- CRM integration rules
- LinkedIn integration rules

## Monitoring and Observability

### Logging

**Systemd Journal**:
```bash
journalctl -u nanobot -f
```

**Log Levels**:
- INFO: Normal operations (agent loop, heartbeat)
- DEBUG: Detailed execution info
- WARNING: Non-critical issues
- ERROR: Failures requiring attention

**Key Log Events**:
- Telegram bot connected
- Agent loop started
- Heartbeat checks (every 1800s)
- Cron service status
- Channel start/stop

### Metrics

**Available via Logs**:
- Message processing times
- Tool execution duration
- LLM API response times
- Session activity
- Memory usage

### Health Checks

**Service Status**:
```bash
systemctl status nanobot
```

**Bot Status**:
- Check logs for "Telegram bot @timx509_bot connected"
- Send test message to bot
- Verify response time

**CRM Status**:
```bash
curl -s http://localhost:3000/healthz
```

## Deployment Pattern

### Single Instance (Current)

- One droplet, one Nanobot instance
- Telegram channel only
- Twenty CRM co-located on same server
- Simple, cost-effective
- 8GB RAM provides ample resources

## Technology Stack

**Runtime**:
- Python 3.12
- Nanobot AI framework (pipx installed)
- Docker 29.x (for Twenty CRM)

**LLM Providers**:
- Google AI (Gemini 2.5 Flash)
- Groq (Llama 3.1 70B - backup)

**Integrations**:
- Telegram Bot API (python-telegram-bot)
- Twenty CRM (REST/GraphQL API)
- ConnectSafely API (LinkedIn)
- Brave Search API (web search)
- Summarize CLI (content extraction)

**Infrastructure**:
- Ubuntu 24.04 LTS (8GB RAM droplet)
- Systemd (service management)
- Docker (Twenty CRM containers)
- Google Drive (mounted at /mnt/gdrive)

## Extension Points

### Adding New Channels

1. Create channel handler in `src/channels/`
2. Implement `Channel` interface
3. Call `registerChannel()` in module
4. Add channel-specific dependencies
5. Rebuild and restart

### Custom Skills

1. Create skill in `.claude/skills/`
2. Define skill metadata (SKILL.md)
3. Implement skill logic
4. Use via Claude Code CLI or manual integration

### Custom Tools

1. Add tool to agent runner allowed tools list
2. Implement tool handler if needed
3. Rebuild container image

### MCP Servers

1. Create MCP server in `src/`
2. Register in agent runner `mcpServers` config
3. Expose via IPC or stdio

## Troubleshooting Architecture

### Container Issues

**Symptom**: Container exits immediately

**Debug**:
```bash
# Check container logs
ls -la /opt/nanoclaw/groups/telegram_main/logs/
cat /opt/nanoclaw/groups/telegram_main/logs/container-*.log

# Check Docker
docker ps -a
docker logs <container_id>
```

### Database Issues

**Symptom**: Messages not persisting

**Debug**:
```bash
# Check database
sqlite3 /opt/nanoclaw/store/nanoclaw.db
.tables
SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10;
```

### Network Issues

**Symptom**: API calls failing

**Debug**:
```bash
# Test credential proxy
curl http://localhost:3001/v1/messages

# Test Anthropic API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

## References

- [NanoClaw Source](https://github.com/qwibitai/nanoclaw)
- [Claude Code SDK](https://www.npmjs.com/package/@anthropic-ai/claude-code)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Docker Documentation](https://docs.docker.com/)
