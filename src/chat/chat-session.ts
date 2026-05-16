import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { ContentBlock, JsonlEvent } from './jsonl-types';

const CLAUDE_CMD = 'claude.cmd'; // Windows

/**
 * 跑一次 claude --print --output-format stream-json --resume <sid> <text>
 * 用 one-shot 模式、每個 user message 開一個新 process、結束後 jsonl 已更新
 *
 * 為什麼不長駐 process：
 *   - --print --input-format stream-json 模式有時行為怪
 *   - one-shot 簡單、jsonl 是錨定、process 死掉沒差
 *   - 每 turn 1-2 秒啟動成本可接受
 */
export class ChatTurnRunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string;
  private cwd: string;
  private buffer = '';

  constructor(sessionId: string, cwd: string) {
    super();
    this.sessionId = sessionId;
    this.cwd = cwd;
  }

  /**
   * 跑一個 user message、emit:
   *   'block' (block: ContentBlock) - 每個 assistant 訊息的 content block
   *   'done' (cost: number) - 整個 turn 完成
   *   'error' (message: string) - 失敗
   */
  run(text: string): void {
    if (this.process) {
      this.emit('error', '已有 turn 在跑');
      return;
    }

    const cwd = fs.existsSync(this.cwd) ? this.cwd : os.homedir();

    this.process = spawn(
      CLAUDE_CMD,
      [
        '--print',
        '--output-format', 'stream-json',
        '--verbose', // stream-json 需要 verbose
        '--resume', this.sessionId,
        text,
      ],
      {
        cwd,
        shell: true,
        env: process.env,
      }
    );

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      let nl: number;
      while ((nl = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        if (line) this.handleLine(line);
      }
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      // 大多是 noise、不送 error event；console log 給開發者看
      console.error('[claude stderr]', text);
    });

    this.process.on('close', (code) => {
      this.process = null;
      if (code !== 0) {
        this.emit('error', `claude CLI exit code ${code}`);
      } else {
        this.emit('done');
      }
    });

    this.process.on('error', (err) => {
      this.process = null;
      this.emit('error', err.message);
    });
  }

  private handleLine(line: string): void {
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    // stream-json 每行是一個 message envelope
    // type: 'system' | 'assistant' | 'user' | 'result'
    if (event.type === 'assistant' && event.message?.content) {
      const blocks: ContentBlock[] = event.message.content;
      for (const block of blocks) {
        this.emit('block', block);
      }
    } else if (event.type === 'user' && event.message?.content) {
      // user 訊息回顯（含 tool_result）
      const blocks: ContentBlock[] = event.message.content;
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          this.emit('tool-result', block);
        }
      }
    } else if (event.type === 'result') {
      // turn 結束 marker、可選送 cost
      this.emit('result', event);
    }
  }

  cancel(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
