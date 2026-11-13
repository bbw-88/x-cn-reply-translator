(() => {
  const editorSelector = '[contenteditable="true"][role="textbox"][data-testid^="tweetTextarea_"]';
  const submitSelector = '[data-testid="tweetButton"],[data-testid="tweetButtonInline"]';
  const replyLabel = /^(?:Reply|回复|回覆|返信|답글|Responder|Répondre|Antworten|Rispondi|Balas|Trả lời|Yanıtla|Ответить)$/iu;
  const replyPlaceholder = /Post your reply|Tweet your reply|发布你的回复|發佈你的回覆|發表你的回覆|回复帖子|回覆貼文/iu;
  const han = /\p{Script=Han}/u;
  const panels = new Map();

  function isReply(editor) {
    const description = editor.getAttribute('aria-describedby');
    if (description && replyPlaceholder.test(document.getElementById(description)?.textContent ?? '')) {
      return true;
    }
    const dialog = editor.closest('[role="dialog"]');
    for (let scope = editor.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
      if (scope.querySelectorAll(editorSelector).length > 1) break;
      const buttons = scope.querySelectorAll(submitSelector);
      if (buttons.length) {
        return [...buttons].some((button) => replyLabel.test(button.textContent.trim()));
      }
      if (scope === dialog || scope.matches('main')) break;
    }
    return false;
  }

  function draftText(editor) {
    return editor.innerText.replace(/[\u200B\uFEFF]/gu, '').trim();
  }

  async function fillReply(editor, translation, original) {
    editor.focus({ preventScroll: true });
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) {
      range.setStart(first, 0);
      let last = first;
      while (walker.nextNode()) last = walker.currentNode;
      range.setEnd(last, last.length);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    // Give Draft.js time to synchronize the selection before replacing its content.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (document.activeElement !== editor || !editor.contains(selection.anchorNode) || draftText(editor) !== original) return false;

    // Draft.js handles paste events and updates its own editor state.
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', translation);
    editor.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData, bubbles: true, cancelable: true,
    }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (draftText(editor) === translation) return true;

    // A native editing command also emits input for ordinary contenteditable fields.
    if (draftText(editor)) return false;
    editor.focus({ preventScroll: true });
    document.execCommand('insertText', false, translation);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return draftText(editor) === translation;
  }

  function mount(editor, anchor) {
    const host = document.createElement('div');
    host.style.display = 'block';
    host.style.margin = '4px 0';
    host.style.flex = 'none';
    host.style.width = '100%';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = [
      '<style>',
      ':host { color-scheme:light dark; }',
      '* { box-sizing:border-box; }',
      'button,textarea { font:inherit; }',
      'button { cursor:pointer; }',
      'button:focus-visible,textarea:focus-visible { outline:2px solid #1d9bf0; outline-offset:2px; }',
      'button:disabled { cursor:default; opacity:.55; }',
      '.wrap { font:14px/1.4 system-ui,"Microsoft YaHei",sans-serif; }',
      '.open,.close { padding:4px 0; color:#1478b5; background:transparent; border:0; font-weight:650; }',
      '.open { padding:5px 10px; border:1px solid currentColor; border-radius:16px; }',
      '.panel { padding:10px; border:1px solid #8899a655; border-radius:12px; background:#1d9bf009; }',
      '.panel[hidden],.open[hidden] { display:none; }',
      'textarea { width:100%; min-height:65px; display:block; padding:8px; resize:vertical; color:inherit;',
      '  background:transparent; border:1px solid #8899a677; border-radius:8px; }',
      '.controls { margin-top:8px; display:flex; align-items:center; flex-wrap:wrap; gap:8px 12px; }',
      '.translate { background:#1478b5; border:0; border-radius:18px; color:white; font-weight:650; padding:6px 13px; }',
      '.status { margin:6px 0 0; font-size:13px; overflow-wrap:anywhere; }',
      '.status:empty { display:none; }',
      '@media (prefers-color-scheme: dark) { .open,.close { color:#62bcff; } }',
      '</style>',
      '<div class="wrap" lang="zh-CN">',
      '<button class="open" type="button" aria-expanded="false" aria-controls="x-reply-cn-panel">中文回复 → 英文</button>',
      '<div class="panel" id="x-reply-cn-panel" hidden>',
      '<textarea rows="2" maxlength="450" placeholder="在这里写中文回复…" aria-label="中文回复" spellcheck="false"></textarea>',
      '<div class="controls">',
      '<button class="translate" type="button" title="Ctrl+Enter">翻译并填入</button>',
      '<button class="close" type="button">收起</button>',
      '</div>',
      '<p class="status" role="status" aria-live="polite"></p>',
      '</div></div>',
    ].join('');
    const open = root.querySelector('.open');
    const panel = root.querySelector('.panel');
    const source = root.querySelector('textarea');
    const translate = root.querySelector('.translate');
    const close = root.querySelector('.close');
    const status = root.querySelector('.status');
    let lastFilled = '';
    let busy = false;
    let composing = false;

    function toggle(expanded) {
      open.hidden = expanded;
      open.setAttribute('aria-expanded', String(expanded));
      panel.hidden = !expanded;
      (expanded ? source : open).focus({ preventScroll: true });
    }

    async function translateAndFill() {
      if (busy || composing) return;
      const raw = source.value;
      const text = raw.trim();
      if (!han.test(text)) {
        status.textContent = '请先输入中文。';
        source.focus();
        return;
      }
      const original = draftText(editor);
      if (original && original !== lastFilled) {
        status.textContent = '原回复框已有文字。请先保留或清空原稿，再填入译文。';
        return;
      }

      busy = true;
      translate.disabled = true;
      const route = location.href;
      status.textContent = '正在本机翻译，首次使用可能稍慢…';
      try {
        const result = await chrome.runtime.sendMessage({ target: 'background', text });
        if (result?.error || !result?.translation) {
          status.textContent = result?.error || '翻译暂时不可用，请重试。';
          return;
        }
        if (!editor.isConnected || !host.isConnected || location.href !== route || !isReply(editor)) return;
        if (composing || source.value !== raw || draftText(editor) !== original || panel.hidden) {
          status.textContent = '草稿有变动，点击「翻译并填入」可重新翻译。';
          return;
        }
        if (!await fillReply(editor, result.translation, original)) {
          status.textContent = 'X 回复框未确认填入，中文已保留。请检查回复框后重试。';
          return;
        }
        lastFilled = result.translation;
        status.textContent = '已填入英文，可以直接修改或发送。';
      } catch {
        status.textContent = '翻译未完成，中文已保留。请刷新 X 页面后重试。';
      } finally {
        busy = false;
        translate.disabled = false;
      }
    }

    open.addEventListener('click', () => toggle(true));
    close.addEventListener('click', () => toggle(false));
    translate.addEventListener('click', translateAndFill);
    source.addEventListener('compositionstart', () => { composing = true; });
    source.addEventListener('compositionend', () => { composing = false; });
    source.addEventListener('input', () => {
      if (!busy) status.textContent = '';
    });
    for (const type of ['keydown', 'keyup', 'keypress']) {
      root.addEventListener(type, (event) => {
        event.stopPropagation();
        if (type === 'keydown' && event.key === 'Enter' && (event.ctrlKey || event.metaKey) &&
            event.target === source && !event.isComposing && event.keyCode !== 229 && !composing) {
          event.preventDefault();
          translateAndFill();
        }
      });
    }
    anchor.before(host);
    return host;
  }

  function scan() {
    for (const [editor, host] of panels) {
      if (editor.isConnected && host.isConnected && isReply(editor)) continue;
      host.remove();
      panels.delete(editor);
    }
    for (const editor of document.querySelectorAll(editorSelector)) {
      if (panels.has(editor) || !isReply(editor)) continue;
      const label = editor.closest('[data-testid^="tweetTextarea_"][data-testid$="_label"]');
      // The rich-text wrapper can have a fixed height. Use the composer layout
      // above it so X's formatting toolbar cannot cover the controls.
      const anchor = label?.firstElementChild ??
        editor.closest('[data-testid$="RichTextInputContainer"]') ?? editor;
      panels.set(editor, mount(editor, anchor));
    }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  scan();
})();
