// 簡化的 jsonl event 型別、只覆蓋我們渲染要用的部分

export type Role = 'user' | 'assistant';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: 'text'; text: string }>;
  is_error?: boolean;
}

export interface ImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock;

export interface JsonlMessage {
  role: Role;
  content: ContentBlock[] | string;
  model?: string;
}

export interface JsonlEvent {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  isSidechain?: boolean;
  message?: JsonlMessage;
  timestamp?: string;
}

// 渲染用的訊息結構（從 jsonl event 抽取出來）
export interface ChatTurn {
  role: Role;
  blocks: ContentBlock[];
  timestamp?: string;
}
