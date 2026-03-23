# 🖥️ Project Golem Web Dashboard 使用說明

> 最後更新：2026-03-23  
> Dashboard 技術棧：Next.js (Static Export) + Tailwind CSS + Socket.IO

## 一、啟動方式

```bash
# 開發模式 (含熱更新)
cd web-dashboard
npm run dev        # 預設：http://localhost:3000

# 生產模式 (靜態匯出)
npm run build
# 由 project root 的 server.js 提供服務
node server.js     # 預設：http://localhost:3000
```

> Dashboard 與主 Bot (`index.js`) 是**獨立進程**，可分別啟動。Dashboard 透過 Socket.IO 與 Bot 即時通訊。

---

## 二、頁面功能說明

### 🎛️ 戰術控制台 (`/dashboard`)

首頁概覽，呈現：
- 目前 Active Golem 的狀態
- 動態情境圖像（依使用技能/多代理場景切換）
- 快速操作入口

---

### 💻 終端機控制台 (`/dashboard/terminal`)

**直接向 Golem 傳送訊息並觀察即時回應**，等同於管理員頻道的 Terminal 介面。

功能：
- 即時對話輸入
- 顯示 Golem 完整輸出（含 Action 執行記錄）
- 支援 Golem 切換

---

### 📚 技能說明書 (`/dashboard/skills`)

技能管理中心：

| 功能 | 說明 |
|------|------|
| 列出所有技能 | 顯示 CORE / USER 技能及描述 |
| 開關技能 | 啟用/停用特定技能 |
| 注入技能書 | 重新將技能書注入 Gemini（相當於 `/reload`） |
| 匯出/匯入膠囊 | 透過 `GOLEM_SKILL::` 字串分享技能 |

---

### 👥 Agent 會議室 (`/dashboard/agents`)

**InteractiveMultiAgent 系統的視覺化介面**。

功能：
- 設定參與協作的 Agent 列表（名稱/角色/個性）
- 設定最大討論輪次
- 啟動多代理圓桌討論
- 即時顯示每個 Agent 的發言與共識摘要

---

### 🔌 MCP 工具 (`/dashboard/mcp`) 🆕

**Model Context Protocol 管理中心**，用於整合外部工具與資料源。

功能：
- **Server 管理**：新增/編輯/刪除 MCP Server（支援 stdio 傳輸）。
- **連線測試**：一鍵測試 Golem 與 Server 的連線狀態。
- **工具查閱**：即時顯示各個 Server 提供的工具名稱與參數定義。
- **實時日誌**：觀察 JSON-RPC 往返細項，除錯必備。

---

### 🏢 自動化中心 (`/dashboard/office`)

管理系統的**自動化任務**，包含排程檢查、系統自省與定期維護日誌。

---

### 🧠 記憶核心 (`/dashboard/memory`)

向量記憶庫的管理介面：

| 功能 | 說明 |
|------|------|
| 瀏覽記憶 | 列出所有已存入的長期記憶條目 |
| 搜尋召回 | 輸入關鍵字測試語意搜尋 |
| 刪除記憶 | 移除特定記憶條目 |
| 清空重置 | 清除全部向量記憶 |

---

### ⚙️ 系統總表 (`/dashboard/settings`)

系統設定與狀態監控：

| 功能 | 說明 |
|------|------|
| Golem 清單 | 顯示所有 Golem 實例及運行狀態 |
| 環境變數管理 | 查看/修改 `.env` 設定 |
| 日誌管理 | 觸發日誌壓縮、查看壓縮歷史 |
| 系統升級 | 觸發 GitHub 熱更新 |

---

左側側欄頂部顯示 **Active Golem 狀態**（預設為 golem_A），所有操作（終端機、記憶查詢、技能管理）均針對此實體。

---

## 四、Setup 流程 (`/dashboard/system-setup`)

首次使用或系統尚未初始化時，會導向 System Setup 頁面：

1. 設定資料目錄 (`USER_DATA_DIR`)
2. 設定記憶模式 (`GOLEM_MEMORY_MODE`，預設 `lancedb-pro`)
3. 設定遠端存取與密碼（`ALLOW_REMOTE_ACCESS` / `REMOTE_ACCESS_PASSWORD`）
4. 儲存後寫入 `.env`，並由後端重新載入配置

> 建議：若開啟遠端存取，務必設定 `REMOTE_ACCESS_PASSWORD`，並搭配 `SYSTEM_OP_TOKEN` 保護高風險操作。

---

## 五、後端 API (`web-dashboard/server.js`)

Dashboard 後端主要 API 與即時通訊能力如下：

| 路由 | 說明 |
|------|------|
| `GET /api/system/status` | 取得系統與執行狀態 |
| `GET /api/system/config` | 讀取系統設定（含記憶模式） |
| `POST /api/system/config` | 更新系統設定（受保護） |
| `POST /api/system/login` / `POST /api/system/logout` | 遠端登入/登出 |
| `GET /api/system/security/events` | 讀取安全事件紀錄 |
| `GET /api/golems` | 取得 Golem 列表 |
| `POST /api/chat` | 發送 Web 端對話訊息 |
| `GET /api/memory` | 查詢向量記憶條目 |
| `POST /api/upload` | 上傳檔案（受大小限制） |
| `GET /api/mcp/servers` | 取得 MCP Server 列表 |
| `POST /api/mcp/servers/:name/test` | 測試指定 MCP 連線 |
| `GET /api/mcp/logs` | 讀取 MCP 調用日誌 |
| `Socket.IO` | 即時推送 Golem 回應、系統事件、MCP 日誌 |

### 安全更新重點

- API 層已啟用速率限制與遠端 Session 驗證。
- 敏感操作（例如 system restart/shutdown、MCP 寫入、技能/記憶異動）需通過 operation guard。
- 若設定 `SYSTEM_OP_TOKEN`，敏感操作需額外提供 `x-system-op-token`。
- 上傳與附件路徑已做大小與目錄邊界檢查（防止濫用與越界路徑）。

---

## 六、Multi-Agent 會議室運作流程

```
用戶設定：
  任務描述、Agent 名稱/角色、最大輪次
       ↓
InteractiveMultiAgent.startConversation()
       ↓
  Round 1: Agent A 發言 → Agent B 發言 → Agent C 發言
  Round 2: 各 Agent 回應彼此 + 用戶可插話 (@ 標記)
  ...
  早期共識偵測 → 提前結束討論
       ↓
_generateSummary() → 產生最終共識摘要傳回用戶
```

**用戶介入**：在任何輪次用戶都可以發言，透過 `@AgentName` 點名特定 Agent 回應，或發送全體廣播。
