(() => {
  const vscode = acquireVsCodeApi();
  const REGISTER = window.REGISTER;
  let selectedAgentId = null;

  // ───────────────────────────────────────
  //  Tree（紅框）
  // ───────────────────────────────────────
  function renderTree() {
    const pane = document.getElementById('tree-pane');
    const groups = [
      {
        body: 'LL',
        label: 'LL 體系',
        sections: [
          { level: 'executive', heading: '執行長' },
          { level: 'secretary', heading: '秘書長' },
          { level: 'coordinator', heading: '協理' },
          { level: 'manager', heading: '經理' },
          { level: 'specialist', heading: '專員' },
          { level: 'deputy', heading: '副手' },
        ],
      },
      {
        body: 'cwsoft',
        label: 'cwsoft',
        sections: [
          { level: 'coordinator', heading: '協理' },
          { level: 'manager', heading: '經理' },
          { level: 'specialist', heading: '專員' },
        ],
      },
    ];

    let html = '';
    for (const group of groups) {
      html += `<div class="tree-group"><div class="tree-group-title">${group.label}</div>`;
      for (const sec of group.sections) {
        const agents = REGISTER.agents.filter(
          (a) => a.body === group.body && a.level === sec.level
        );
        if (!agents.length) continue;
        html += `<div class="tree-section">`;
        html += `<div class="tree-section-heading">${sec.heading}</div>`;
        for (const a of agents) {
          const lvl = REGISTER.levels[a.level];
          const dormantClass = a.status === 'dormant' ? ' dormant' : '';
          const shortLabel = makeShortLabel(a);
          html += `
            <div class="tree-item${dormantClass}" data-id="${escapeAttr(a.id)}">
              <span class="tree-emoji">${lvl.emoji}</span>
              <span class="tree-label">${escapeHtml(shortLabel)}</span>
            </div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    pane.innerHTML = html;
    pane.querySelectorAll('.tree-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        selectAgent(id);
      });
    });
  }

  function makeShortLabel(agent) {
    // 簡稱：頭銜 + repo（取前 8 字以內）
    return agent.title;
  }

  // ───────────────────────────────────────
  //  選擇 agent
  // ───────────────────────────────────────
  function selectAgent(agentId) {
    selectedAgentId = agentId;
    document.querySelectorAll('.tree-item').forEach((el) => {
      el.classList.toggle('selected', el.getAttribute('data-id') === agentId);
    });
    vscode.postMessage({ command: 'select-agent', agentId });
  }

  // ───────────────────────────────────────
  //  訊息接收（從 extension 來）
  // ───────────────────────────────────────
  window.addEventListener('message', (e) => {
    const msg = e.data;
    switch (msg.command) {
      case 'agent-selected':
        onAgentSelected(msg.agent, msg.level, msg.history);
        break;
      case 'append-turn':
        appendTurn(msg.agentId, msg.turn);
        break;
      case 'stream-block':
        streamBlock(msg.agentId, msg.block);
        break;
      case 'stream-tool-result':
        streamToolResult(msg.agentId, msg.block);
        break;
      case 'turn-done':
        onTurnDone(msg.agentId);
        break;
      case 'turn-error':
        onTurnError(msg.agentId, msg.message);
        break;
    }
  });

  // ───────────────────────────────────────
  //  資訊條（黃框）+ 對話歷史載入
  // ───────────────────────────────────────
  function onAgentSelected(agent, level, history) {
    renderInfoBar(agent, level);
    renderHistory(history);
    enableInput(true);
  }

  function renderInfoBar(agent, level) {
    const pane = document.getElementById('info-pane');
    const future = agent.future_promotion
      ? `<span class="info-future">🚀 未來升 <b>${escapeHtml(agent.future_promotion.to)}</b></span>`
      : '';
    const direct = agent.direct_to_colombo
      ? `<span class="info-direct">⚡ 直對 colombo</span>`
      : '';
    const also = agent.also_serves_as
      ? `<span class="info-extra">兼 ${escapeHtml(agent.also_serves_as)}</span>`
      : '';
    pane.innerHTML = `
      <div class="info-line">
        <span class="info-emoji">${level.emoji}</span>
        <span class="info-title">${escapeHtml(agent.title)}</span>
        <code class="info-id">${escapeHtml(agent.id)}</code>
        <span class="info-status status-${agent.status}">${agent.status}</span>
        ${also} ${direct} ${future}
      </div>
      <div class="info-role">${escapeHtml(agent.role)}</div>
    `;
  }

  function renderHistory(history) {
    const msgs = document.getElementById('chat-messages');
    msgs.innerHTML = '';
    for (const turn of history) {
      msgs.appendChild(renderTurn(turn));
    }
    scrollToBottom();
  }

  // ───────────────────────────────────────
  //  訊息渲染
  // ───────────────────────────────────────
  function renderTurn(turn) {
    const div = document.createElement('div');
    div.className = `turn turn-${turn.role}`;
    const blocksHtml = turn.blocks.map(renderBlock).join('');
    div.innerHTML = `
      <div class="turn-avatar">${turn.role === 'user' ? '👤' : '🤖'}</div>
      <div class="turn-content">${blocksHtml}</div>
    `;
    return div;
  }

  function renderBlock(block) {
    if (block.type === 'text') {
      return `<div class="block-text">${renderMarkdownLite(block.text || '')}</div>`;
    }
    if (block.type === 'tool_use') {
      return renderToolUse(block);
    }
    if (block.type === 'tool_result') {
      return renderToolResult(block);
    }
    if (block.type === 'image') {
      return `<div class="block-image">[image]</div>`;
    }
    return '';
  }

  function renderToolUse(block) {
    const name = block.name || 'Tool';
    const input = block.input || {};
    let summary = '';
    if (input.file_path) summary = String(input.file_path);
    else if (input.path) summary = String(input.path);
    else if (input.command) summary = String(input.command).slice(0, 80);
    else if (input.pattern) summary = String(input.pattern);
    else if (input.url) summary = String(input.url);
    const emoji = toolEmoji(name);
    const inputJson = escapeHtml(JSON.stringify(input, null, 2));
    const summaryHtml = summary ? `<code class="tool-summary clickable" data-path="${escapeAttr(summary)}">${escapeHtml(summary)}</code>` : '';
    return `
      <details class="block-tool-use">
        <summary>${emoji} <b>${escapeHtml(name)}</b> ${summaryHtml}</summary>
        <pre class="tool-input">${inputJson}</pre>
      </details>
    `;
  }

  function renderToolResult(block) {
    let content = '';
    if (typeof block.content === 'string') content = block.content;
    else if (Array.isArray(block.content)) {
      content = block.content
        .map((c) => (c && c.text ? c.text : ''))
        .join('\n');
    }
    const truncated = content.length > 1000;
    const display = truncated ? content.slice(0, 1000) + '\n…(截斷)' : content;
    const errClass = block.is_error ? ' tool-result-error' : '';
    return `
      <details class="block-tool-result${errClass}">
        <summary>↳ tool result ${truncated ? '(已截斷)' : ''}</summary>
        <pre>${escapeHtml(display)}</pre>
      </details>
    `;
  }

  function toolEmoji(name) {
    const map = {
      Read: '📖', Write: '✏️', Edit: '✏️', NotebookEdit: '✏️',
      Glob: '🔍', Grep: '🔍',
      Bash: '⚙️', PowerShell: '⚙️',
      Task: '🤖', WebFetch: '🌐', WebSearch: '🌐',
      TodoWrite: '📝',
    };
    return map[name] || '🔧';
  }

  // ───────────────────────────────────────
  //  Streaming（新 turn 進行中）
  // ───────────────────────────────────────
  let currentAssistantTurn = null;
  let currentAssistantBlocks = [];

  function appendTurn(agentId, turn) {
    if (agentId !== selectedAgentId) return;
    const msgs = document.getElementById('chat-messages');
    msgs.appendChild(renderTurn(turn));
    scrollToBottom();
  }

  function streamBlock(agentId, block) {
    if (agentId !== selectedAgentId) return;
    const msgs = document.getElementById('chat-messages');

    if (!currentAssistantTurn) {
      currentAssistantTurn = document.createElement('div');
      currentAssistantTurn.className = 'turn turn-assistant streaming';
      currentAssistantTurn.innerHTML = `
        <div class="turn-avatar">🤖</div>
        <div class="turn-content"></div>
      `;
      msgs.appendChild(currentAssistantTurn);
      currentAssistantBlocks = [];
    }

    currentAssistantBlocks.push(block);
    const content = currentAssistantTurn.querySelector('.turn-content');
    content.innerHTML = currentAssistantBlocks.map(renderBlock).join('');
    bindClickables(content);
    scrollToBottom();
  }

  function streamToolResult(agentId, block) {
    if (agentId !== selectedAgentId) return;
    if (!currentAssistantTurn) return;
    const content = currentAssistantTurn.querySelector('.turn-content');
    content.insertAdjacentHTML('beforeend', renderToolResult(block));
    bindClickables(content);
    scrollToBottom();
  }

  function onTurnDone(agentId) {
    if (agentId !== selectedAgentId) return;
    if (currentAssistantTurn) {
      currentAssistantTurn.classList.remove('streaming');
    }
    currentAssistantTurn = null;
    currentAssistantBlocks = [];
    enableInput(true);
  }

  function onTurnError(agentId, message) {
    if (agentId !== selectedAgentId) return;
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'turn-error';
    div.textContent = '❌ ' + message;
    msgs.appendChild(div);
    currentAssistantTurn = null;
    currentAssistantBlocks = [];
    enableInput(true);
    scrollToBottom();
  }

  // ───────────────────────────────────────
  //  輸入
  // ───────────────────────────────────────
  function enableInput(enabled) {
    document.getElementById('chat-input').disabled = !enabled;
    document.getElementById('chat-send').disabled = !enabled;
  }

  function setupInput() {
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');

    function submit() {
      const text = input.value.trim();
      if (!text || !selectedAgentId) return;
      enableInput(false);
      vscode.postMessage({ command: 'send-message', agentId: selectedAgentId, text });
      input.value = '';
    }

    send.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
  }

  // ───────────────────────────────────────
  //  Inline file links（點 [📖 PROJECT.md] 開檔案）
  // ───────────────────────────────────────
  function bindClickables(root) {
    root.querySelectorAll('.clickable[data-path]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const p = el.getAttribute('data-path');
        if (p && (p.includes('/') || p.includes('\\'))) {
          vscode.postMessage({ command: 'open-file', filePath: p });
        }
      });
    });
  }

  // ───────────────────────────────────────
  //  helpers
  // ───────────────────────────────────────
  function scrollToBottom() {
    const msgs = document.getElementById('chat-messages');
    msgs.scrollTop = msgs.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  // 極簡 markdown：` ` 行內 code、``` ``` code block、保留換行
  function renderMarkdownLite(text) {
    const esc = escapeHtml(text);
    // code block
    let html = esc.replace(/```([\s\S]*?)```/g, (_, c) => `<pre class="code-block">${c}</pre>`);
    // inline code
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // 粗體
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    // 偵測檔案路徑 → 變 clickable
    html = html.replace(
      /([A-Za-z]:[\\/][^\s<>"]+|\/[A-Za-z][^\s<>"]*\.[a-z]{2,6})/g,
      (p) => `<code class="clickable" data-path="${p}">${p}</code>`
    );
    return html;
  }

  // ───────────────────────────────────────
  //  init
  // ───────────────────────────────────────
  renderTree();
  setupInput();
  // bind clickables on initial render (history loaded later)
  document.addEventListener('click', (e) => {
    if (e.target.matches('.clickable[data-path]')) {
      const p = e.target.getAttribute('data-path');
      if (p) vscode.postMessage({ command: 'open-file', filePath: p });
    }
  });
})();
