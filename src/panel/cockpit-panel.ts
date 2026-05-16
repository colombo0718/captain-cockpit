import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadRegister, Register, Agent } from '../data/register-loader';
import { findJsonlPath, loadHistory } from '../chat/history-loader';
import { ChatTurnRunner } from '../chat/chat-session';
import { ChatTurn, ContentBlock } from '../chat/jsonl-types';

interface AgentChatState {
  history: ChatTurn[];
  currentRunner: ChatTurnRunner | null;
  pendingBlocks: ContentBlock[]; // 累積中的 assistant blocks（直到 turn 結束才轉成 turn）
}

export class CockpitPanel {
  public static current: CockpitPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private register: Register | null = null;
  private agentState = new Map<string, AgentChatState>();
  private selectedAgentId: string | null = null;

  public static createOrShow(extensionUri: vscode.Uri): void {
    const col = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (CockpitPanel.current) {
      CockpitPanel.current.panel.reveal(col);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'captainCockpit',
      '🎩 Captain Cockpit',
      col,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );
    CockpitPanel.current = new CockpitPanel(panel, extensionUri);
  }

  public static refresh(): void {
    CockpitPanel.current?.reload();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panel.onDidDispose(() => {
      // 清掉所有 runner
      for (const state of this.agentState.values()) {
        state.currentRunner?.cancel();
      }
      CockpitPanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.reload();
  }

  private reload(): void {
    try {
      this.register = loadRegister();
      this.panel.webview.html = this.renderShell();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.panel.webview.html = `<html><body style="font-family:system-ui;padding:20px;color:#d4d4d4;background:#0f1419">
        <h2>讀取 register 失敗</h2><pre>${escapeHtml(message)}</pre>
      </body></html>`;
    }
  }

  private handleMessage(msg: any): void {
    if (msg.command === 'select-agent') {
      this.selectAgent(msg.agentId);
    } else if (msg.command === 'send-message') {
      this.sendMessage(msg.agentId, msg.text);
    } else if (msg.command === 'open-file') {
      this.openFile(msg.filePath);
    } else if (msg.command === 'open-url') {
      vscode.env.openExternal(vscode.Uri.parse(msg.url));
    } else if (msg.command === 'refresh') {
      this.reload();
    }
  }

  private selectAgent(agentId: string): void {
    if (!this.register) return;
    const agent = this.register.agents.find((a) => a.id === agentId);
    if (!agent) return;

    this.selectedAgentId = agentId;

    // 載入歷史（lazy、第一次選才載）
    if (!this.agentState.has(agentId)) {
      const jsonlPath = findJsonlPath(agent.sid8);
      const history = jsonlPath ? loadHistory(jsonlPath) : [];
      this.agentState.set(agentId, {
        history,
        currentRunner: null,
        pendingBlocks: [],
      });
    }

    const state = this.agentState.get(agentId)!;
    this.panel.webview.postMessage({
      command: 'agent-selected',
      agent,
      level: this.register.levels[agent.level],
      history: state.history,
    });
  }

  private sendMessage(agentId: string, text: string): void {
    if (!this.register) return;
    const agent = this.register.agents.find((a) => a.id === agentId);
    if (!agent) return;

    const state = this.agentState.get(agentId);
    if (!state) return;

    if (state.currentRunner) {
      this.panel.webview.postMessage({
        command: 'turn-error',
        agentId,
        message: '上一輪還在跑、等他結束',
      });
      return;
    }

    // 立即把 user message 加進 history、推進 webview
    const userTurn: ChatTurn = {
      role: 'user',
      blocks: [{ type: 'text', text }],
      timestamp: new Date().toISOString(),
    };
    state.history.push(userTurn);
    this.panel.webview.postMessage({
      command: 'append-turn',
      agentId,
      turn: userTurn,
    });

    // spawn claude turn
    const cwd = this.guessRepoPath(agent.repo);
    const runner = new ChatTurnRunner(agent.session_id, cwd);
    state.currentRunner = runner;
    state.pendingBlocks = [];

    runner.on('block', (block: ContentBlock) => {
      state.pendingBlocks.push(block);
      this.panel.webview.postMessage({
        command: 'stream-block',
        agentId,
        block,
      });
    });

    runner.on('tool-result', (block: ContentBlock) => {
      this.panel.webview.postMessage({
        command: 'stream-tool-result',
        agentId,
        block,
      });
    });

    runner.on('done', () => {
      // 把累積的 assistant blocks 收成一個 turn
      if (state.pendingBlocks.length > 0) {
        state.history.push({
          role: 'assistant',
          blocks: state.pendingBlocks,
          timestamp: new Date().toISOString(),
        });
        state.pendingBlocks = [];
      }
      state.currentRunner = null;
      this.panel.webview.postMessage({ command: 'turn-done', agentId });
    });

    runner.on('error', (errMsg: string) => {
      state.currentRunner = null;
      state.pendingBlocks = [];
      this.panel.webview.postMessage({
        command: 'turn-error',
        agentId,
        message: errMsg,
      });
    });

    runner.run(text);
  }

  private openFile(filePath: string): void {
    try {
      const uri = vscode.Uri.file(filePath);
      vscode.commands.executeCommand('vscode.open', uri);
    } catch (err) {
      vscode.window.showErrorMessage(`無法開啟 ${filePath}`);
    }
  }

  private guessRepoPath(repo: string): string {
    // 特殊：Desktop-POS3 在 ~/Desktop/POS3
    if (repo === 'Desktop-POS3') {
      return path.join(os.homedir(), 'Desktop', 'POS3');
    }
    const guess = path.join(os.homedir(), repo);
    return fs.existsSync(guess) ? guess : os.homedir();
  }

  private renderShell(): string {
    if (!this.register) return '';
    const css = fs.readFileSync(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'cockpit.css').fsPath,
      'utf8'
    );
    const js = fs.readFileSync(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'cockpit.js').fsPath,
      'utf8'
    );

    const registerJson = JSON.stringify(this.register);

    return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>Captain Cockpit</title>
  <style>${css}</style>
</head>
<body>
  <div class="layout-v01">
    <aside class="tree-pane" id="tree-pane"></aside>

    <header class="info-pane" id="info-pane">
      <div class="info-empty">← 點任一 agent 開始對話</div>
    </header>

    <section class="chat-pane">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-empty">尚未選擇 agent</div>
      </div>
      <div class="chat-input-wrap">
        <textarea class="chat-input" id="chat-input"
          placeholder="輸入訊息... (Enter 送出、Shift+Enter 換行)"
          disabled></textarea>
        <button class="chat-send" id="chat-send" disabled>送出</button>
      </div>
    </section>
  </div>

  <script>
    window.REGISTER = ${registerJson};
  </script>
  <script>${js}</script>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
