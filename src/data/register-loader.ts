import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Agent {
  id: string;
  sid8: string;
  session_id: string;
  repo: string;
  body: 'LL' | 'cwsoft';
  level: string;
  title: string;
  role: string;
  status: 'active' | 'dormant' | 'frozen';
  joined?: string;
  also_serves_as?: string;
  reports_to?: string;
  deputy_id?: string;
  direct_to_colombo?: boolean;
  sub_brands?: string[];
  future_promotion?: {
    to: string;
    level?: string;
    when: string;
    direct_to_colombo_after?: boolean;
    memo_ref?: string;
  };
  memo_ref?: string;
}

export interface LevelDef {
  emoji: string;
  title: string;
  description: string;
  direct_to_colombo?: boolean;
}

export interface Register {
  version: number;
  updated: string;
  origin?: string;
  levels: Record<string, LevelDef>;
  agents: Agent[];
  totals?: Record<string, number>;
}

function* walkUpCandidates(startDir: string, relPath: string): Generator<string> {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    yield path.join(dir, relPath);
    yield path.join(dir, '..', relPath);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

export function findRegisterPath(): string {
  // 1. 明確設定
  const cfg = vscode.workspace.getConfiguration('captainCockpit').get<string>('registerPath');
  if (cfg && fs.existsSync(cfg)) {
    return cfg;
  }

  // 2. 自動找——workspace 附近的 matrix-manager sibling
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (ws) {
    for (const c of walkUpCandidates(ws, 'matrix-manager/memory/agents-register.json')) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  }

  // 3. 預設假設：~/matrix-manager
  const homeCandidate = path.join(os.homedir(), 'matrix-manager', 'memory', 'agents-register.json');
  if (fs.existsSync(homeCandidate)) {
    return homeCandidate;
  }

  throw new Error(
    '找不到 agents-register.json。請在 VS Code settings.json 設定 captainCockpit.registerPath、或把 matrix-manager 放在 sibling 位置。'
  );
}

export function loadRegister(): Register {
  const p = findRegisterPath();
  const text = fs.readFileSync(p, 'utf8');
  return JSON.parse(text) as Register;
}
