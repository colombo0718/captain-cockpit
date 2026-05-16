import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ChatTurn, JsonlEvent, ContentBlock } from './jsonl-types';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

/**
 * 從 sid8 找出對應的 jsonl 完整路徑、掃 ~/.claude/projects/*\/<sid8>*.jsonl
 */
export function findJsonlPath(sid8: string): string | null {
  if (!fs.existsSync(PROJECTS_DIR)) return null;
  try {
    const projects = fs.readdirSync(PROJECTS_DIR);
    for (const proj of projects) {
      const projDir = path.join(PROJECTS_DIR, proj);
      let entries: string[];
      try {
        entries = fs.readdirSync(projDir);
      } catch {
        continue;
      }
      for (const f of entries) {
        if (f.startsWith(sid8) && f.endsWith('.jsonl')) {
          return path.join(projDir, f);
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * 讀 jsonl、抽出可渲染的 user / assistant turn
 * 忽略：file-history-snapshot、last-prompt、system 等 meta event
 */
export function loadHistory(jsonlPath: string): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let text: string;
  try {
    text = fs.readFileSync(jsonlPath, 'utf8');
  } catch {
    return [];
  }

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let event: JsonlEvent;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    // 跳過 sidechain（subagent 對話、不在主流）
    if (event.isSidechain) continue;

    const msg = event.message;
    if (!msg) continue;

    const role = msg.role;
    if (role !== 'user' && role !== 'assistant') continue;

    // content 有時是 string、有時是 array
    let blocks: ContentBlock[];
    if (typeof msg.content === 'string') {
      blocks = [{ type: 'text', text: msg.content }];
    } else if (Array.isArray(msg.content)) {
      blocks = msg.content as ContentBlock[];
    } else {
      continue;
    }

    // 跳過完全空的 turn
    if (blocks.length === 0) continue;

    turns.push({
      role,
      blocks,
      timestamp: event.timestamp,
    });
  }

  return turns;
}
