# 🖥️ Project Golem Web Dashboard Guide

> Last Updated: 2026-03-20  
> Tech Stack: Next.js + Tailwind CSS + Socket.io

## 1. How to Start

```bash
# Development Mode (with Hot Reload)
cd web-dashboard
npm run dev        # Default: http://localhost:3000

# Production Mode (Static Export)
npm run build
# Served by the project root's server.js
node server.js     # Default: http://localhost:3000
```

> The Dashboard and the main Bot (`index.js`) are **independent processes**. The Dashboard communicates with the Bot in real-time via Socket.io.

---

## 2. Page Overview

### 🎛️ Tactical Console (`/dashboard`)
The home view providing an overview of:
- Active Golem status
- Dynamic context imagery (switches based on active skills/multi-agent scenarios)
- Quick action shortcuts

---

### 💻 Web Terminal (`/dashboard/terminal`)
**Communicate directly with Golem** and observe real-time responses. This is the web equivalent of the admin Telegram terminal.

Features:
- Real-time conversation input
- Full Golem output display (including Action execution logs)
- Instance switching support

---

### 📚 Skill Manager (`/dashboard/skills`)
The central hub for managing Golem's capabilities:
- **List Skills**: View descriptions of CORE and USER skills.
- **Toggle Skills**: Enable or disable specific functions.
- **Inject Skills**: Reload skill books into Gemini (equivalent to `/reload`).

---

### 👥 Agent Room (`/dashboard/agents`)
**The visual interface for the InteractiveMultiAgent system**.
- Configure the participating agent list (Name, Role, Personality).
- Set the maximum number of discussion rounds.
- Start roundtable discussions.
- Real-time display of agent dialogue and consensus summaries.

---

### 🔌 MCP Tools (`/dashboard/mcp`) 🆕
**Model Context Protocol Management Center** for integrating external tools and data sources.
- **Server Management**: Add, edit, or delete MCP Servers (stdio transport).
- **Connection Test**: One-click test for server connectivity.
- **Tool Inspector**: Real-time display of tool names and parameter schemas.
- **Live Logs**: Visualize JSON-RPC traffic for debugging.

---

### 🏢 Automation Center (`/dashboard/office`)
Manages **automated tasks**, including schedule checks, system introspection, and periodic maintenance logs.

---

### 🧠 Memory Core (`/dashboard/memory`)
The management interface for the vector memory store:
- **Browse Memory**: List all stored long-term memory entries.
- **Semantic Search**: Test the semantic search engine with keywords.
- **Delete/Reset**: Remove specific entries or clear the entire memory store.

---

### ⚙️ System Settings (`/dashboard/settings`)
System configuration and status monitoring:
- **Golem List**: View all instances and their health status.
- **Env Variables**: View and modify `.env` settings.
- **Log Management**: Trigger log compression and view history.
- **System Upgrade**: Trigger hot-updates from GitHub.

---

## 3. Backend APIs (server.js)

| Route | Description |
|------|------|
| `GET /api/golems` | Get Golem list |
| `GET /api/status/:id` | Get status of a specific Golem |
| `POST /api/message` | Send a message to Golem |
| `GET /api/mcp/servers` | Get MCP Server list |
| `POST /api/mcp/servers/:name/test` | Test specific MCP connection |
| `GET /api/mcp/logs` | Read MCP call logs |
| `Socket.IO` | Real-time push for responses, system events, and MCP logs |

---

## 4. Multi-Agent Workflow

```
User Configuration:
  Task description, Agent roles, Max rounds
        ↓
InteractiveMultiAgent.startConversation()
        ↓
  Round 1: Agent A speaks → Agent B speaks → Agent C speaks
  Round 2: Each agent responds to others + User can intervene via @mentions
  ...
  Consensus detection → Early termination
        ↓
_generateSummary() → Final consensus summary sent to user
```
