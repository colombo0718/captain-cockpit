import * as vscode from 'vscode';
import * as fs from 'fs';
import { loadRegister, Register, Agent } from '../data/register-loader';

export class CockpitPanel {
  public static current: CockpitPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;

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
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );
    CockpitPanel.current = new CockpitPanel(panel, extensionUri);
  }

  public static refresh(): void {
    CockpitPanel.current?.refresh();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panel.onDidDispose(() => {
      CockpitPanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.refresh();
  }

  private refresh(): void {
    try {
      const register = loadRegister();
      this.panel.webview.html = this.render(register);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.html = `<html><body style="font-family:system-ui;padding:20px;color:#d4d4d4;background:#0f1419">
        <h2>讀取失敗</h2><pre>${escapeHtml(msg)}</pre>
        <p>建議：在 VS Code settings.json 設定 <code>captainCockpit.registerPath</code></p>
      </body></html>`;
    }
  }

  private handleMessage(msg: { command: string; payload?: unknown }): void {
    if (msg.command === 'refresh') {
      this.refresh();
    }
    // 之後可加：resume / dispatch 等
  }

  private render(reg: Register): string {
    const css = fs.readFileSync(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'cockpit.css').fsPath,
      'utf8'
    );

    const groupBy = (body: string, level: string): Agent[] =>
      reg.agents.filter((a) => a.body === body && a.level === level);

    const renderAgent = (a: Agent): string => {
      const lvl = reg.levels[a.level];
      const emoji = lvl?.emoji ?? '?';
      const futureHtml = a.future_promotion
        ? `<div class="future">→ 未來升 <b>${escapeHtml(a.future_promotion.to)}</b>（${escapeHtml(a.future_promotion.when)}）</div>`
        : '';
      const extraHtml = a.also_serves_as ? `<div class="extra">兼：${escapeHtml(a.also_serves_as)}</div>` : '';
      const directHtml = a.direct_to_colombo ? `<div class="direct">⚡ 直對 colombo</div>` : '';
      const dormantClass = a.status === 'dormant' ? ' dormant' : '';
      return `
        <div class="agent${dormantClass}" data-id="${escapeHtml(a.id)}">
          <div class="emoji">${emoji}</div>
          <div class="info">
            <div class="title">${escapeHtml(a.title)} <span class="sid">${escapeHtml(a.sid8)}</span></div>
            <div class="repo">${escapeHtml(a.repo)}</div>
            <div class="role">${escapeHtml(a.role)}</div>
            ${extraHtml}
            ${directHtml}
            ${futureHtml}
          </div>
        </div>`;
    };

    const renderSection = (body: string, level: string, label?: string): string => {
      const agents = groupBy(body, level);
      if (!agents.length) return '';
      const lvl = reg.levels[level];
      const heading = label ?? `${lvl?.emoji ?? ''} ${lvl?.title ?? level}`;
      return `
        <div class="section">
          <h3>${heading} <span class="count">(${agents.length})</span></h3>
          <div class="agents">${agents.map(renderAgent).join('')}</div>
        </div>`;
    };

    const llSections = ['executive', 'secretary', 'coordinator', 'manager', 'specialist', 'deputy'];
    const cwSections = ['coordinator', 'manager', 'specialist'];

    const totals = reg.totals ?? {};

    return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>Captain Cockpit</title>
  <style>${css}</style>
</head>
<body>
  <header>
    <h1>🎩 Captain Cockpit</h1>
    <div class="meta">
      v${reg.version} · 更新於 ${reg.updated} ·
      編制 <b>${totals.formal_headcount ?? '?'}</b> 位（LL ${totals.active_ll ?? '?'} + 新進 ${totals.new_specialists_2026_05_15 ?? '?'} + cwsoft ${totals.active_cwsoft ?? '?'} + 副手 ${totals.deputies_dormant ?? '?'}）
      <button id="refresh-btn">↻ Refresh</button>
    </div>
  </header>

  <main>
    <section class="body-ll">
      <h2>LL 體系</h2>
      ${llSections.map((l) => renderSection('LL', l)).join('')}
    </section>

    <section class="body-cw">
      <h2>cwsoft 體系</h2>
      ${cwSections.map((l) => renderSection('cwsoft', l)).join('')}
    </section>
  </main>

  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });
  </script>
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
