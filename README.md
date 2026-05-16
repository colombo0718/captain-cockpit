# Captain Cockpit

> LL 駕駛艙——讀 [`matrix-manager/memory/agents-register.json`](https://github.com/colombo0718/matrix-manager) 員工名冊、顯示組織樹、Resume / 派工 agent。

## 定位

- LL 治理體系的視覺化控制台
- VS Code Extension、跑在 colombo 工作環境裡（不切視窗）
- 錨定資料在 matrix-manager、本專案只是 viewer + 操作介面

## 安裝（開發中）

```bash
git clone https://github.com/colombo0718/captain-cockpit.git
cd captain-cockpit
npm install
```

然後 VS Code 打開資料夾、按 `F5` 開發 mode（會起一個新 VS Code 視窗、Extension 已載入）。

新視窗裡：
- `Ctrl+Shift+P` → `Captain Cockpit: Open`
- 看到組織樹

## 找不到 register

預設會找以下位置（依序）：

1. `captainCockpit.registerPath`（VS Code settings.json）
2. 目前 workspace 附近的 `matrix-manager/memory/agents-register.json`（sibling）
3. `~/matrix-manager/memory/agents-register.json`

都找不到會在面板顯示錯誤。手動設定範例：

```json
{
  "captainCockpit.registerPath": "C:/Users/USER/matrix-manager/memory/agents-register.json"
}
```

## 對應文件

- 設計初稿：`../matrix-manager/cockpit-plan.md`
- 錨定 schema：`../matrix-manager/memory/agents-register.schema.json`
- 員工編制：`../matrix-manager/agent-staffing-system.md`
