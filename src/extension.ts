import * as vscode from 'vscode';
import { CockpitPanel } from './panel/cockpit-panel';

export function activate(context: vscode.ExtensionContext) {
  const openCmd = vscode.commands.registerCommand('captainCockpit.open', () => {
    CockpitPanel.createOrShow(context.extensionUri);
  });

  const refreshCmd = vscode.commands.registerCommand('captainCockpit.refresh', () => {
    CockpitPanel.refresh();
  });

  context.subscriptions.push(openCmd, refreshCmd);
}

export function deactivate() {}
