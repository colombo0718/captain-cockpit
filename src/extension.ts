import * as vscode from 'vscode';
import { CockpitPanel } from './panel/cockpit-panel';

export function activate(context: vscode.ExtensionContext) {
  const openCmd = vscode.commands.registerCommand('captainCockpit.open', () => {
    CockpitPanel.createOrShow(context.extensionUri);
  });

  const refreshCmd = vscode.commands.registerCommand('captainCockpit.refresh', () => {
    CockpitPanel.refresh();
  });

  // URI handler：讓 vscode://leaflune.captain-cockpit/ 觸發開啟
  // 用途：Windows 工作列釘選的捷徑、點一下就跳開駕駛艙
  const uriHandler = vscode.window.registerUriHandler({
    handleUri() {
      CockpitPanel.createOrShow(context.extensionUri);
    }
  });

  context.subscriptions.push(openCmd, refreshCmd, uriHandler);
}

export function deactivate() {}
